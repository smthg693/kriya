// Dialogue State & Session Memory Manager
// Stores session slots, last_intent, extracted entities, and turn history for Gram Sahayak.

const sessions = new Map();

function getSession(sessionId) {
  if (!sessionId) return { id: 'default', last_intent: null, entities: {}, turn_count: 0 };
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      last_intent: null,
      entities: {},
      turn_count: 0,
      updated_at: new Date()
    });
  }
  return sessions.get(sessionId);
}

function updateSession(sessionId, intent, entities = []) {
  if (!sessionId) return;
  const sess = getSession(sessionId);
  sess.turn_count += 1;
  sess.updated_at = new Date();
  
  if (intent && intent !== 'GREETING' && intent !== 'FALLBACK') {
    sess.last_intent = intent;
  }
  
  if (Array.isArray(entities)) {
    entities.forEach(e => {
      sess.entities[e.type] = e.value;
    });
  }
  sessions.set(sessionId, sess);
}

function resolveContextCarryOver(sessionId, currentIntent, text) {
  const sess = getSession(sessionId);
  const lower = (text || '').toLowerCase();
  
  // If user asks "status" or "kya hua" and we previously discussed a specific scheme (e.g. PMKISAN or SOLAR), carry over context!
  if ((currentIntent === 'STATUS' || lower.includes('status') || lower.includes('kya hua')) && sess.last_intent) {
    return {
      carriedIntent: sess.last_intent,
      isContextual: true
    };
  }
  return {
    carriedIntent: currentIntent,
    isContextual: false
  };
}

module.exports = {
  getSession,
  updateSession,
  resolveContextCarryOver
};
