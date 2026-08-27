const crypto = require('crypto');
const { dbAsync } = require('./database');

const loginAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function getToken(request) {
  const header = request.headers.authorization || '';
  return header.replace(/^Bearer\s+/i, '').trim() || request.body?.token;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function passwordIsStrong(password) {
  return typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function loginRateLimit(request, response, next) {
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000);
    response.set('Retry-After', String(retryAfter));
    return response.status(429).json({ success: false, error: 'Too many login attempts. Try again later.' });
  }
  current.count += 1;
  next();
}

function clearLoginAttempts(request) {
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  loginAttempts.delete(key);
}

async function requireAuth(request, response, next) {
  try {
    const token = getToken(request);
    if (!token) return response.status(401).json({ success: false, error: 'Authentication required' });
    const session = await dbAsync.findSession(token);
    if (!session) return response.status(401).json({ success: false, error: 'Session expired or invalid' });
    const user = await dbAsync.findUserById(session.user_id);
    if (!user || user.disabled) return response.status(401).json({ success: false, error: 'Account is disabled or unavailable' });
    request.auth = { token, session, user };
    next();
  } catch (error) {
    response.status(500).json({ success: false, error: error.message });
  }
}

function requireAdmin(request, response, next) {
  if (request.auth?.user?.role !== 'admin') return response.status(403).json({ success: false, error: 'Admin access required' });
  next();
}

module.exports = { generateToken, passwordIsStrong, loginRateLimit, clearLoginAttempts, requireAuth, requireAdmin };
