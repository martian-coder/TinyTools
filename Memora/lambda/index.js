'use strict';

const Alexa = require('ask-sdk-core');
const { getMemory, saveMemory } = require('./memory');
const { askClaude } = require('./claude');

// ── Launch ────────────────────────────────────────────────────────────────────

const LaunchRequestHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === 'LaunchRequest';
  },
  handle(input) {
    return input.responseBuilder
      .speak("Memora is ready. What's on your mind?")
      .reprompt("I'm listening.")
      .getResponse();
  },
};

// ── Main query ────────────────────────────────────────────────────────────────

const MemoraQueryHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(input.requestEnvelope) === 'MemoraQueryIntent'
    );
  },
  async handle(input) {
    const userId = input.requestEnvelope.context.System.user.userId;
    const utterance = (
      Alexa.getSlotValue(input.requestEnvelope, 'query') || ''
    ).trim();

    if (!utterance) {
      return input.responseBuilder
        .speak("I didn't catch that. What would you like to know?")
        .reprompt("Go ahead, I'm listening.")
        .getResponse();
    }

    // Send a progressive response so Alexa doesn't time out while Claude is running.
    // Must go through the Directive Service, not responseBuilder.addDirective.
    try {
      const directiveServiceClient = input.serviceClientFactory.getDirectiveServiceClient();
      await directiveServiceClient.enqueue({
        header: { requestId: input.requestEnvelope.request.requestId },
        directive: { type: 'VoicePlayer.Speak', speech: '<speak>Let me think.</speak>' },
      });
    } catch (_) {
      // Progressive responses are not supported on all Alexa surfaces — safe to ignore
    }

    const { history, facts } = await getMemory(userId);

    const { reply, newFacts } = await askClaude(history, facts, utterance);

    const updatedHistory = [
      ...history,
      { role: 'user', content: utterance },
      { role: 'assistant', content: reply },
    ];

    const updatedFacts = newFacts.length
      ? [...new Set([...facts, ...newFacts])]
      : facts;

    await saveMemory(userId, updatedHistory, updatedFacts);

    return input.responseBuilder
      .speak(reply)
      .reprompt("Anything else?")
      .getResponse();
  },
};

// ── Help ──────────────────────────────────────────────────────────────────────

const HelpHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(input.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(input) {
    return input.responseBuilder
      .speak(
        "Memora remembers what you tell it and answers your questions using Claude AI. " +
        "Just say whatever's on your mind, or tell me something you'd like me to remember. What can I help you with?"
      )
      .reprompt("What would you like to know?")
      .getResponse();
  },
};

// ── Stop / Cancel ─────────────────────────────────────────────────────────────

const CancelAndStopHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
      (Alexa.getIntentName(input.requestEnvelope) === 'AMAZON.CancelIntent' ||
        Alexa.getIntentName(input.requestEnvelope) === 'AMAZON.StopIntent')
    );
  },
  handle(input) {
    return input.responseBuilder.speak('Goodbye.').getResponse();
  },
};

// ── Fallback ──────────────────────────────────────────────────────────────────

const FallbackHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(input.requestEnvelope) === 'AMAZON.FallbackIntent'
    );
  },
  handle(input) {
    return input.responseBuilder
      .speak("Sorry, I'm not sure how to help with that. Try asking me a question.")
      .reprompt("What would you like to know?")
      .getResponse();
  },
};

// ── Session ended ─────────────────────────────────────────────────────────────

const SessionEndedHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(input) {
    // Alexa sends this when the session closes; return an empty response
    const reason = input.requestEnvelope.request.reason;
    if (reason === 'ERROR') {
      console.error('Session ended with error:', JSON.stringify(input.requestEnvelope.request.error));
    }
    return input.responseBuilder.getResponse();
  },
};

// ── Error handler ─────────────────────────────────────────────────────────────

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(input, error) {
    console.error('Unhandled error:', error.message, error.stack);
    return input.responseBuilder
      .speak("Something went wrong on my end. Please try again in a moment.")
      .reprompt("Please try again.")
      .getResponse();
  },
};

// ── Export ────────────────────────────────────────────────────────────────────

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    MemoraQueryHandler,
    HelpHandler,
    CancelAndStopHandler,
    FallbackHandler,
    SessionEndedHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
