const NLU_SERVICE_URL = process.env.NLU_SERVICE_URL || 'http://localhost:8000/parse';

async function parseNLU(text, sessionId = null) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout threshold

    const response = await fetch(NLU_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, session_id: sessionId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ NLU Microservice returned HTTP ${response.status}. Falling back to internal engine.`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    // If Python service is offline, log notice once and fallback gracefully
    console.warn(`ℹ️ NLU Service unavailable (${err.message}). Operating in Resilient Shadow Mode.`);
    return null;
  }
}

module.exports = { parseNLU };
