'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { sendToRenderer, initializeNewSession, saveConversationTurn } = require('./gemini');

let anthropicClient = null;
let anthropicModel = null;
let conversationHistory = [];
let currentSystemPrompt = null;
let isActive = false;

// ── Helpers ────────────────────────────────────────────────────────────────

function resumeListening() {
    sendToRenderer('update-status', 'Listening...');
}

// Pop the last user turn so a blocked message doesn't taint future requests.
function dropLastUserTurn() {
    if (
        conversationHistory.length > 0 &&
        conversationHistory[conversationHistory.length - 1].role === 'user'
    ) {
        conversationHistory.pop();
    }
}

// ── Core generation ────────────────────────────────────────────────────────

async function sendToAnthropic(transcription) {
    if (!anthropicClient || !isActive) {
        console.error('[Anthropic] Client not configured');
        return;
    }
    if (!transcription || !transcription.trim()) return;

    console.log('[Anthropic] Sending:', transcription.substring(0, 100));

    conversationHistory.push({ role: 'user', content: transcription.trim() });
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }

    sendToRenderer('update-status', 'Generating response...');

    let stream;
    try {
        stream = anthropicClient.messages.stream({
            model: anthropicModel,
            max_tokens: 1024,
            system: [
                {
                    type: 'text',
                    text: currentSystemPrompt,
                    cache_control: { type: 'ephemeral' },
                },
            ],
            messages: conversationHistory,
        });
    } catch (err) {
        console.error('[Anthropic] Failed to create stream:', err.message);
        dropLastUserTurn();
        sendToRenderer('update-status', 'Claude error: ' + err.message);
        sendToRenderer('new-response', '⚠ **Claude API error:** ' + err.message);
        return;
    }

    let fullText = '';
    let isFirst = true;

    try {
        for await (const event of stream) {
            if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
            ) {
                fullText += event.delta.text;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }
    } catch (err) {
        console.error('[Anthropic] Stream error:', err.message);
        dropLastUserTurn();
        const friendly = err.status === 401
            ? '⚠ **Invalid API key.** Check your Claude API key in settings.'
            : err.status === 429
            ? '⚠ **Rate limited.** Wait a moment and try again.'
            : '⚠ **Claude error:** ' + err.message;
        sendToRenderer('new-response', friendly);
        sendToRenderer('update-status', 'Error — Listening...');
        return;
    }

    try {
        const finalMsg = await stream.finalMessage();
        const cached = finalMsg.usage?.cache_read_input_tokens || 0;
        if (cached > 0) console.log('[Anthropic] Cache hit tokens:', cached);
    } catch (err) {
        // finalMessage() can throw on filtered responses — the streamed text
        // is still valid if we got any, so only bail if we have nothing.
        console.error('[Anthropic] finalMessage error:', err.message);
        if (!fullText.trim()) {
            dropLastUserTurn();
            resumeListening();
            return;
        }
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

async function initializeAnthropicProvider(apiKey, model, systemPrompt) {
    if (!apiKey || !String(apiKey).trim()) {
        throw new Error('Anthropic API key is required. Add it in Settings → Claude API.');
    }
    anthropicClient = new Anthropic({ apiKey });
    anthropicModel = model || 'claude-sonnet-4-6';
    currentSystemPrompt = systemPrompt || 'You are a helpful meeting assistant.';
    conversationHistory = [];
    isActive = true;
    console.log('[Anthropic] Provider initialized with model:', anthropicModel);
    return true;
}

async function sendAnthropicText(text) {
    if (!isActive || !anthropicClient) {
        return { success: false, error: 'No active Anthropic session' };
    }
    try {
        await sendToAnthropic(text);
        return { success: true };
    } catch (err) {
        dropLastUserTurn();
        resumeListening();
        return { success: false, error: err.message };
    }
}

async function sendAnthropicImage(base64Data, prompt) {
    if (!isActive || !anthropicClient) {
        return { success: false, error: 'No active Anthropic session' };
    }

    sendToRenderer('update-status', 'Analyzing image...');

    let stream;
    try {
        stream = anthropicClient.messages.stream({
            model: anthropicModel,
            max_tokens: 1024,
            system: [
                {
                    type: 'text',
                    text: currentSystemPrompt,
                    cache_control: { type: 'ephemeral' },
                },
            ],
            messages: [
                ...conversationHistory.slice(-10),
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/jpeg',
                                data: base64Data,
                            },
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
        console.error('[Anthropic] Image stream create error:', err.message);
        resumeListening();
        return { success: false, error: err.message };
    }

    let fullText = '';
    let isFirst = true;

    try {
        for await (const event of stream) {
            if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
            ) {
                fullText += event.delta.text;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }
    } catch (err) {
        console.error('[Anthropic] Image stream error:', err.message);
        resumeListening();
        return { success: false, error: err.message };
    }

    if (fullText.trim()) {
        // Record the full multimodal user turn (image + text), not just the text
        // prompt — otherwise the model loses the image context on later turns.
        conversationHistory.push({
            role: 'user',
            content: [
                {
                    type: 'image',
                    source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
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
    return { success: true, text: fullText, model: anthropicModel };
}

function closeAnthropicProvider() {
    console.log('[Anthropic] Closing provider');
    isActive = false;
    anthropicClient = null;
    anthropicModel = null;
    currentSystemPrompt = null;
    conversationHistory = [];
}

function isAnthropicActive() {
    return isActive;
}

module.exports = {
    initializeAnthropicProvider,
    sendToAnthropic,
    sendAnthropicText,
    sendAnthropicImage,
    closeAnthropicProvider,
    isAnthropicActive,
};
