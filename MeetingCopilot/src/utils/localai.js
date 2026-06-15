'use strict';

const { getSystemPrompt } = require('./prompts');
const { sendToRenderer, initializeNewSession, saveConversationTurn } = require('./gemini');
const { AudioPipeline } = require('../audio');

// ── State ──────────────────────────────────────────────────────────────────

let whisperPipeline = null;
let isWhisperLoading = false;
let localConversationHistory = [];
let currentSystemPrompt = null;
let isLocalActive = false;
let externalLlmFn = null;
let translateMode = true;

let audioPipeline = null;

// ── Whisper ────────────────────────────────────────────────────────────────

async function loadWhisperPipeline(modelName) {
    if (whisperPipeline) return whisperPipeline;
    if (isWhisperLoading) return null;

    isWhisperLoading = true;
    sendToRenderer('whisper-downloading', true);
    sendToRenderer('update-status', 'Loading Whisper model (first run downloads ~250 MB)...');

    try {
        const { pipeline, env } = await import('@huggingface/transformers');
        const { app } = require('electron');
        const path = require('path');
        env.cacheDir = path.join(app.getPath('userData'), 'whisper-models');

        whisperPipeline = await pipeline('automatic-speech-recognition', modelName, {
            dtype: 'q8',
            device: 'auto',
        });

        sendToRenderer('whisper-downloading', false);
        isWhisperLoading = false;
        return whisperPipeline;
    } catch (err) {
        console.error('[LocalAI] Whisper load failed:', err);
        sendToRenderer('whisper-downloading', false);
        sendToRenderer('update-status', 'Whisper load failed: ' + err.message);
        isWhisperLoading = false;
        return null;
    }
}

async function transcribeAudio(pcm16kBuffer) {
    if (!whisperPipeline) return null;

    try {
        const n = Math.floor(pcm16kBuffer.length / 2);
        const f32 = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            f32[i] = pcm16kBuffer.readInt16LE(i * 2) / 32768;
        }

        const result = await whisperPipeline(f32, {
            sampling_rate: 16000,
            ...(translateMode
                ? { task: 'translate' }
                : { task: 'transcribe', language: 'en' }),
        });

        const text = result.text?.trim();
        console.log('[LocalAI] Transcription:', text);
        return text || null;
    } catch (err) {
        console.error('[LocalAI] Transcription error:', err);
        return null;
    }
}

// ── Speech-end handler (called by AudioPipeline on each utterance) ─────────

async function handleSpeechEnd(audioBuffer) {
    if (!isLocalActive) return;

    sendToRenderer('update-status', 'Transcribing...');

    const transcription = await transcribeAudio(audioBuffer);

    if (!transcription || transcription.length < 2) {
        sendToRenderer('update-status', 'Listening...');
        return;
    }

    sendToRenderer('transcript-update', transcription);
    sendToRenderer('update-status', 'Generating response...');

    if (externalLlmFn) {
        await externalLlmFn(transcription);
    } else {
        await sendToOllama(transcription);
    }
}

// ── Ollama Chat ────────────────────────────────────────────────────────────

async function sendToOllama(transcription) {
    if (!ollamaClient || !ollamaModel) {
        console.error('[LocalAI] Ollama not configured');
        sendToRenderer('update-status', 'Ollama not configured — check settings');
        return;
    }

    localConversationHistory.push({ role: 'user', content: transcription });
    if (localConversationHistory.length > 20) {
        localConversationHistory = localConversationHistory.slice(-20);
    }

    try {
        const messages = [
            { role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' },
            ...localConversationHistory,
        ];

        const response = await ollamaClient.chat({ model: ollamaModel, messages, stream: true });

        let fullText = '';
        let isFirst = true;
        for await (const part of response) {
            const token = part.message?.content || '';
            if (token) {
                fullText += token;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        if (fullText.trim()) {
            localConversationHistory.push({ role: 'assistant', content: fullText.trim() });
            saveConversationTurn(transcription, fullText);
        }

        sendToRenderer('update-status', 'Listening...');
    } catch (err) {
        console.error('[LocalAI] Ollama error:', err);
        sendToRenderer('update-status', 'Ollama error: ' + err.message);
    }
}

let ollamaClient = null;
let ollamaModel = null;

// ── AudioPipeline helpers ──────────────────────────────────────────────────

function createPipeline(whisperModel, captureSource) {
    const { app } = require('electron');
    const path = require('path');

    const cacheDir = path.join(app.getPath('userData'), 'silero-vad');

    const pipeline = new AudioPipeline({
        captureOptions: { source: captureSource || 'system' },
        cacheDir,
        preSpeechBufferMs: 500,
        maxSpeechMs: 45000,
        minSpeechMs: 300,
    });

    pipeline.on('status', msg => sendToRenderer('update-status', msg));
    pipeline.on('speech-start', () => sendToRenderer('update-status', 'Listening... (speech detected)'));
    pipeline.on('vad-ready', () => {
        console.log('[LocalAI] Silero VAD ready');
        sendToRenderer('update-status', 'Listening...');
    });

    pipeline.on('speech-end', ({ audio }) => {
        handleSpeechEnd(audio).catch(err => console.error('[LocalAI] speech-end handler:', err));
    });

    pipeline.on('error', err => {
        console.error('[LocalAI] Pipeline error:', err);
        // Surface setup-guidance hints (BlackHole, VB-Cable etc.) in the UI
        const msg = err.message.includes('\n\nFix:')
            ? err.message.split('\n\nFix:')[1].split('\n')[0].trim()
            : err.message.split('\n')[0];
        sendToRenderer('update-status', '⚠ Audio error — ' + msg);
        sendToRenderer('audio-error', { message: err.message });
    });

    return pipeline;
}

// ── Public API ─────────────────────────────────────────────────────────────

async function initializeLocalSession(
    ollamaHost, model, whisperModel, profile, customPrompt, translate = true
) {
    translateMode = translate;
    sendToRenderer('session-initializing', true);

    try {
        currentSystemPrompt = getSystemPrompt(profile, customPrompt, false);
        const { Ollama } = require('ollama');
        ollamaClient = new Ollama({ host: ollamaHost });
        ollamaModel = model;

        try {
            await ollamaClient.list();
        } catch (err) {
            sendToRenderer('session-initializing', false);
            sendToRenderer('update-status', 'Cannot connect to Ollama at ' + ollamaHost);
            return false;
        }

        const pipe = await loadWhisperPipeline(whisperModel);
        if (!pipe) { sendToRenderer('session-initializing', false); return false; }

        localConversationHistory = [];
        initializeNewSession(profile, customPrompt);

        audioPipeline = createPipeline(whisperModel, 'system');
        await audioPipeline.start();

        isLocalActive = true;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Local AI ready — Listening...');
        return true;
    } catch (err) {
        console.error('[LocalAI] Init error:', err);
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Local AI error: ' + err.message);
        return false;
    }
}

async function initializeLocalWhisperSession(
    whisperModel, profile, customPrompt, translate = true
) {
    translateMode = translate;
    sendToRenderer('session-initializing', true);

    try {
        currentSystemPrompt = getSystemPrompt(profile, customPrompt, false);

        const pipe = await loadWhisperPipeline(whisperModel);
        if (!pipe) { sendToRenderer('session-initializing', false); return false; }

        localConversationHistory = [];
        externalLlmFn = null;
        initializeNewSession(profile, customPrompt);

        audioPipeline = createPipeline(whisperModel, 'system');
        await audioPipeline.start();

        isLocalActive = true;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Ready — Listening...');
        return true;
    } catch (err) {
        console.error('[LocalAI] Whisper init error:', err);
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Whisper init error: ' + err.message);
        return false;
    }
}

function closeLocalSession() {
    isLocalActive = false;
    if (audioPipeline) {
        audioPipeline.stop();
        audioPipeline = null;
    }
    localConversationHistory = [];
    ollamaClient = null;
    ollamaModel = null;
    currentSystemPrompt = null;
    externalLlmFn = null;
}

function isLocalSessionActive() {
    return isLocalActive;
}

function setExternalLlmFn(fn) {
    externalLlmFn = fn;
}

function forceFlush() {
    if (audioPipeline) audioPipeline.forceFlush();
}

async function sendLocalText(text) {
    if (!isLocalActive || !ollamaClient) {
        return { success: false, error: 'No active local session' };
    }
    try {
        await sendToOllama(text);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function sendLocalImage(base64Data, prompt) {
    if (!isLocalActive || !ollamaClient) {
        return { success: false, error: 'No active local session' };
    }

    try {
        sendToRenderer('update-status', 'Analyzing image...');

        const userMessage = { role: 'user', content: prompt, images: [base64Data] };
        localConversationHistory.push({ role: 'user', content: prompt });
        if (localConversationHistory.length > 20) {
            localConversationHistory = localConversationHistory.slice(-20);
        }

        const messages = [
            { role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' },
            ...localConversationHistory.slice(0, -1),
            userMessage,
        ];

        const response = await ollamaClient.chat({ model: ollamaModel, messages, stream: true });

        let fullText = '';
        let isFirst = true;
        for await (const part of response) {
            const token = part.message?.content || '';
            if (token) {
                fullText += token;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        if (fullText.trim()) {
            localConversationHistory.push({ role: 'assistant', content: fullText.trim() });
            saveConversationTurn(prompt, fullText);
        }

        sendToRenderer('update-status', 'Listening...');
        return { success: true, text: fullText, model: ollamaModel };
    } catch (err) {
        console.error('[LocalAI] Image error:', err);
        sendToRenderer('update-status', 'Ollama error: ' + err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    initializeLocalSession,
    initializeLocalWhisperSession,
    closeLocalSession,
    isLocalSessionActive,
    setExternalLlmFn,
    forceFlush,
    sendLocalText,
    sendLocalImage,
};
