// NLU Logger: Persists every utterance, predicted intent, confidence score, and executed action into MongoDB.

async function logNLUEvent(dbAsync, payload) {
  if (!dbAsync) return;
  try {
    const doc = {
      text: payload.text,
      predicted_intent: payload.intent,
      confidence: payload.confidence,
      final_action: payload.action,
      language: payload.language || 'en',
      citizen_id: payload.citizenId || null,
      session_id: payload.sessionId || null,
      timestamp: new Date()
    };
    await dbAsync.insert('nlu_logs', doc);
  } catch (err) {
    console.error("NLU Logger error:", err.message);
  }
}

module.exports = { logNLUEvent };
