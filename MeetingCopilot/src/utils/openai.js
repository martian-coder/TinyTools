'use strict';

const OpenAI = require('openai');
const { sendToRenderer, saveConversationTurn } = require('./gemini');

let openaiClient = null;
let openaiModel = null;
let conversationHistory = [];
let currentSystemPrompt = null;
let isActive = false;

// ── Helpers ────────────────────────────────────────────────────────────────

function resumeListening() {
    sendToRenderer('update-status', 'Listening...');
}

function dropLastUserTurn() {
    if (
        conversationHistory.length > 0 &&
        conversationHistory[conversationHistory.length - 1].role === 'user'
    ) {
        conversationHistory.pop();
    }
}

// ── Core generation ────────────────────────────────────────────────────────

async function sendToOpenAI(transcription) {
    if (!openaiClient || !isActive) {
        console.error('[OpenAI] Client not configured');
        return;
    }
    if (!transcription || !transcription.trim()) return;

    if (process.env.DEBUG) console.log('[OpenAI] Sending:', transcription.substring(0, 100));

    conversationHistory.push({ role: 'user', content: transcription.trim() });
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }

    sendToRenderer('update-status', 'Generating response...');

    let stream;
    try {
        stream = await openaiClient.chat.completions.create({
            model: openaiModel,
            max_tokens: 1024,
            stream: true,
            messages: [
                { role: 'system', content: currentSystemPrompt },
                ...conversationHistory,
            ],
        });
    } catch (err) {
        console.error('[OpenAI] Failed to create stream:', err.message);
        dropLastUserTurn();
        sendToRenderer('update-status', 'OpenAI error: ' + err.message);
        sendToRenderer('new-response', '⚠ **OpenAI error:** ' + err.message);
        return;
    }

    let fullText = '';
    let isFirst = true;

    try {
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullText += content;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }
    } catch (err) {
        console.error('[OpenAI] Stream error:', err.message);
        dropLastUserTurn();
        const friendly = err.status === 401
            ? '⚠ **Invalid API key.** Check your OpenAI API key in settings.'
            : err.status === 429
            ? '⚠ **Rate limited.** Wait a moment and try again.'
            : '⚠ **OpenAI error:** ' + err.message;
        sendToRenderer('new-response', friendly);
        sendToRenderer('update-status', 'Error — Listening...');
        return;
    }

    if (fullText.trim()) {
        conversationHistory.push({ role: 'assistant', content: fullText.trim() });
        saveConversationTurn(transcription, fullText);
    } else {
        dropLastUserTurn();
    }

    resumeListening();
}

// ── Public API ─────────────────────────────────────────────────────────────

async function initializeOpenAIProvider(apiKey, model, systemPrompt) {
    if (!apiKey || !String(apiKey).trim()) {
        throw new Error('OpenAI API key is required. Add it in Settings → OpenAI.');
    }
    openaiClient = new OpenAI({ apiKey });
    openaiModel = model || 'gpt-4o-mini';
    currentSystemPrompt = systemPrompt || 'You are a helpful meeting assistant.';
    conversationHistory = [];
    isActive = true;
    console.log('[OpenAI] Provider initialized with model:', openaiModel);
    return true;
}

async function sendOpenAIText(text) {
    if (!isActive || !openaiClient) {
        return { success: false, error: 'No active OpenAI session' };
    }
    try {
        await sendToOpenAI(text);
        return { success: true };
    } catch (err) {
        dropLastUserTurn();
        resumeListening();
        return { success: false, error: err.message };
    }
}

async function sendOpenAIImage(base64Data, prompt) {
    if (!isActive || !openaiClient) {
        return { success: false, error: 'No active OpenAI session' };
    }

    sendToRenderer('update-status', 'Analyzing image...');

    let stream;
    try {
        stream = await openaiClient.chat.completions.create({
            model: openaiModel,
            max_tokens: 1024,
            stream: true,
            messages: [
                { role: 'system', content: currentSystemPrompt },
                ...conversationHistory.slice(-10),
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: `data:image/jpeg;base64,${base64Data}` },
                        },
                        {
                            type: 'text',
                            text: prompt || 'Describe what is visible on screen and provide a concise, professional summary relevant to the current meeting context.',
                        },
                    ],
                },
            ],
        });
    } catch (err) {
        console.error('[OpenAI] Image stream create error:', err.message);
        resumeListening();
        return { success: false, error: err.message };
    }

    let fullText = '';
    let isFirst = true;

    try {
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullText += content;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }
    } catch (err) {
        console.error('[OpenAI] Image stream error:', err.message);
        resumeListening();
        return { success: false, error: err.message };
    }

    if (fullText.trim()) {
        conversationHistory.push({
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64Data}` },
                },
                {
                    type: 'text',
                    text: prompt || 'Describe what is visible on screen and provide a concise, professional summary relevant to the current meeting context.',
                },
            ],
        });
        conversationHistory.push({ role: 'assistant', content: fullText.trim() });
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }
        saveConversationTurn(prompt, fullText);
    }

    resumeListening();
    return { success: true, text: fullText, model: openaiModel };
}

function closeOpenAIProvider() {
    console.log('[OpenAI] Closing provider');
    isActive = false;
    openaiClient = null;
    openaiModel = null;
    currentSystemPrompt = null;
    conversationHistory = [];
}

function isOpenAIActive() {
    return isActive;
}

module.exports = {
    initializeOpenAIProvider,
    sendToOpenAI,
    sendOpenAIText,
    sendOpenAIImage,
    closeOpenAIProvider,
    isOpenAIActive,
};
