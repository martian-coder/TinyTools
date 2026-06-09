const Anthropic = require('@anthropic-ai/sdk');
const { sendToRenderer, initializeNewSession, saveConversationTurn } = require('./gemini');

let anthropicClient = null;
let anthropicModel = null;
let conversationHistory = [];
let currentSystemPrompt = null;
let isActive = false;

async function initializeAnthropicProvider(apiKey, model, systemPrompt) {
    anthropicClient = new Anthropic({ apiKey });
    anthropicModel = model || 'claude-sonnet-4-6';
    currentSystemPrompt = systemPrompt || 'You are a helpful meeting assistant.';
    conversationHistory = [];
    isActive = true;
    console.log('[Anthropic] Provider initialized with model:', anthropicModel);
}

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

    try {
        const stream = anthropicClient.messages.stream({
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

        let fullText = '';
        let isFirst = true;

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                fullText += event.delta.text;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        const finalMsg = await stream.finalMessage();
        const cached = finalMsg.usage?.cache_read_input_tokens || 0;
        if (cached > 0) console.log('[Anthropic] Cache hit tokens:', cached);

        if (fullText.trim()) {
            conversationHistory.push({ role: 'assistant', content: fullText.trim() });
            saveConversationTurn(transcription, fullText);
        }

        sendToRenderer('update-status', 'Listening...');
    } catch (error) {
        console.error('[Anthropic] Error:', error);
        sendToRenderer('update-status', 'Claude error: ' + error.message);
    }
}

async function sendAnthropicText(text) {
    if (!isActive || !anthropicClient) {
        return { success: false, error: 'No active Anthropic session' };
    }
    try {
        await sendToAnthropic(text);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendAnthropicImage(base64Data, prompt) {
    if (!isActive || !anthropicClient) {
        return { success: false, error: 'No active Anthropic session' };
    }

    sendToRenderer('update-status', 'Analyzing image...');
    try {
        const stream = anthropicClient.messages.stream({
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
                            source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
                        },
                        { type: 'text', text: prompt || 'Analyze this screen and suggest what to say.' },
                    ],
                },
            ],
        });

        let fullText = '';
        let isFirst = true;

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                fullText += event.delta.text;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        if (fullText.trim()) {
            conversationHistory.push({ role: 'user', content: prompt });
            conversationHistory.push({ role: 'assistant', content: fullText.trim() });
            saveConversationTurn(prompt, fullText);
        }

        sendToRenderer('update-status', 'Listening...');
        return { success: true, text: fullText, model: anthropicModel };
    } catch (error) {
        console.error('[Anthropic] Image error:', error);
        sendToRenderer('update-status', 'Claude error: ' + error.message);
        return { success: false, error: error.message };
    }
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
