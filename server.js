const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { initDatabase, dbAsync } = require('./database');
const { generateToken, passwordIsStrong, loginRateLimit, clearLoginAttempts, requireAuth, requireAdmin } = require('./auth');
const { processUserQuery } = require('./nlp_engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || false }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) return callback(null, true);
    callback(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// WebSockets Setup
io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log('Client connected to WebSockets:', socket.id);
  socket.join(user.role === 'admin' ? 'admins' : `citizen:${user.id}`);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const session = token ? await dbAsync.findSession(token) : null;
    const user = session ? await dbAsync.findUserById(session.user_id) : null;
    if (!user || user.disabled) return next(new Error('Authentication required'));
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Helper for Emergency Priority Auto-Triage
function detectPriority(text, category) {
  const t = text.toLowerCase();
  if (t.includes('fire') || t.includes('wire') || t.includes('spark') || t.includes('fallen') || t.includes('flood') || t.includes('emergency') || t.includes('danger') || t.includes('आग') || t.includes('तार') || t.includes('खतरा')) {
    return 'Critical';
  }
  if (t.includes('leak') || t.includes('no water') || t.includes('broken') || t.includes('sewage') || t.includes('मरी') || t.includes('खराब')) {
    return 'High';
  }
  if (category === 'Water Supply' || category === 'Electricity') {
    return 'Medium';
  }
  return 'Low';
}

// ==================== REST API ENDPOINTS ==================== //

// 1. AUTHENTICATION (Database-backed Session Auth)
app.post('/api/auth/login', loginRateLimit, async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ success: false, error: 'Username/email and password are required' });
    const user = await dbAsync.findUserByLogin(loginId, password);

    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    clearLoginAttempts(req);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await dbAsync.insert('sessions', { token, user_id: user.id, role: user.role, expires_at: expiresAt, created_at: new Date() });

    return res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, name, mobile, village, password } = req.body;
    const finalUsername = (username || mobile || email || '').trim();
    if (!finalUsername) return res.status(400).json({ success: false, error: 'Username, mobile, or email is required' });
    if (!passwordIsStrong(password)) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters and include a letter and a number' });
    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ success: false, error: 'Enter a valid email address' });

    const newId = 'CIT-' + Date.now();
    const defaultAvatar = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPRc6GYVwSy_AKt35qAxkHsARWBl5vkCni8miFTxQR8qgHr2_JKmagVvtoyYpYeUXR33tu82w316-dtwxbBRrYb47oHQ2ZW--l_X2XL7RruFntCX-8Ly_gxGrZpHIn0Qhd8TvmLd6tk__mqLTCNrmGanbMBa6JUzvaQyEU1sKWj_nJT5Bt88ga-VgUhVIjAdAE7EQolO9zNeDp-yH6WtskdaUO-C9WE-TR55b5NZBd7VZuVE421Sj6-g';

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = {
      id: newId,
      username: finalUsername,
      name: (name || finalUsername).trim(),
      village: (village || 'Kalyanpur').trim(),
      password_hash: passwordHash,
      aadhaar_verified: 1,
      avatar_url: defaultAvatar,
      role: 'user',
      language: 'en',
      preferences: {},
      created_at: new Date()
    };

    if (mobile && mobile.trim()) newUser.mobile = mobile.trim();
    if (email && email.trim()) newUser.email = email.trim();

    await dbAsync.insertUser(newUser);

    const user = await dbAsync.findUserById(newId);
    io.emit('citizen_registered', user);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await dbAsync.insert('sessions', { token, user_id: user.id, role: user.role, expires_at: expiresAt, created_at: new Date() });

    res.json({ success: true, token, user });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 500).json({ success: false, error: err.code === 11000 ? 'Username, email, or mobile is already registered' : err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.body.token;
    if (token) {
      await dbAsync.remove('sessions', { token });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ success: true, user: req.auth.user }));

app.get('/api/profile', requireAuth, (req, res) => res.json({ success: true, profile: req.auth.user }));

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const allowed = ['name', 'mobile', 'village', 'avatar_url', 'language', 'preferences'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    await dbAsync.update('users', { id: req.auth.user.id }, { $set: changes });
    res.json({ success: true, profile: await dbAsync.findUserById(req.auth.user.id) });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 500).json({ success: false, error: err.code === 11000 ? 'Mobile number is already registered' : err.message });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  res.json({ success: true, users: await dbAsync.listUsers() });
});

app.get('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const user = await dbAsync.findUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, user });
});

app.put('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const allowed = ['name', 'mobile', 'village', 'email', 'username', 'preferences', 'disabled'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  await dbAsync.update('users', { id: req.params.id }, { $set: changes });
  const user = await dbAsync.findUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, user });
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.auth.user.id) return res.status(400).json({ success: false, error: 'You cannot delete your own admin account' });
  await dbAsync.deleteUser(req.params.id);
  await dbAsync.remove('sessions', { user_id: req.params.id });
  res.json({ success: true });
});

app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  if (!passwordIsStrong(req.body.password)) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters and include a letter and a number' });
  await dbAsync.update('users', { id: req.params.id }, { $set: { password_hash: await bcrypt.hash(req.body.password, 12) } });
  await dbAsync.remove('sessions', { user_id: req.params.id });
  res.json({ success: true, message: 'Password reset successfully' });
});

// 2. DASHBOARD STATS
app.get('/api/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [activeReports, resolvedReports, criticalEmergencies, totalCitizens, pendingApplications] = await Promise.all([
      dbAsync.count('reports', { status: { $ne: 'Resolved' } }),
      dbAsync.count('reports', { status: 'Resolved' }),
      dbAsync.count('reports', { priority: 'Critical', status: { $ne: 'Resolved' } }),
      dbAsync.count('users', { role: 'user' }),
      dbAsync.count('applications', { status: { $ne: 'Approved' } })
    ]);

    res.json({
      activeReports,
      resolvedThisMonth: resolvedReports,
      criticalEmergencies,
      avgResponseDays: 2.5,
      totalCitizens,
      pendingApplications
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. REPORTS API
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const { status, category, citizenId } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (category && category !== 'All') filter.category = category;
    if (req.auth.user.role !== 'admin') filter.citizen_id = req.auth.user.id;
    else if (citizenId) filter.citizen_id = citizenId;
    const reports = await dbAsync.findMany('reports', filter, { sort: { created_at: -1 } });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { category, location, description, citizen_id, citizen_name } = req.body;
    const repNum = Math.floor(100 + Math.random() * 900);
    const reportId = `#REP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const priority = detectPriority(description || '', category || '');
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    await dbAsync.insert('reports', { id: reportId, category: category || 'General', location: location || 'Panchayat Area', description: description || 'Issue reported', photo_url, status: 'Pending', priority, citizen_id: req.auth.user.id, citizen_name: req.auth.user.name, date: todayStr, created_at: new Date(), updated_at: new Date() });

    const newReport = await dbAsync.findOne('reports', { id: reportId });

    // Broadcast live event to all clients / admins!
    io.to('admins').emit('report_created', newReport);
    io.to(`citizen:${req.auth.user.id}`).emit('report_created', newReport);

    res.json({ success: true, report: newReport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/reports/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { status, admin_notes } = req.body;

    const reportUpdate = { status, updated_at: new Date() };
    if (admin_notes !== undefined && admin_notes !== null) reportUpdate.admin_notes = admin_notes;
    await dbAsync.update('reports', { id: reportId }, { $set: reportUpdate });

    const updatedReport = await dbAsync.findOne('reports', { id: reportId });

    // Emit live WebSocket update to citizens and admins!
    io.to('admins').emit('report_updated', updatedReport);
    if (updatedReport?.citizen_id) io.to(`citizen:${updatedReport.citizen_id}`).emit('report_updated', updatedReport);

    res.json({ success: true, report: updatedReport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. SCHEME APPLICATIONS API
app.get('/api/applications', requireAuth, async (req, res) => {
  try {
    const { citizenId } = req.query;
    const filter = req.auth.user.role === 'admin' ? (citizenId ? { citizen_id: citizenId } : {}) : { citizen_id: req.auth.user.id };
    const apps = await dbAsync.findMany('applications', filter, { sort: { created_at: -1 } });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/applications', requireAuth, async (req, res) => {
  try {
    const { scheme_type, citizen_id, citizen_name, details } = req.body;
    const appNum = Math.floor(1000 + Math.random() * 9000);
    const appId = `#APP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    await dbAsync.insert('applications', { id: appId, scheme_type: scheme_type || 'General Scheme', citizen_id: req.auth.user.id, citizen_name: req.auth.user.name, status: 'Submitted', progress_pct: 25, details_json: JSON.stringify(details || {}), created_at: new Date(), updated_at: new Date() });

    const newApp = await dbAsync.findOne('applications', { id: appId });

    // Emit live socket event
    io.to('admins').emit('application_submitted', newApp);
    io.to(`citizen:${req.auth.user.id}`).emit('application_submitted', newApp);

    res.json({ success: true, application: newApp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/applications/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const appId = req.params.id;
    const { status, progress_pct, admin_notes } = req.body;

    const appUpdate = { status, updated_at: new Date() };
    if (progress_pct !== undefined && progress_pct !== null) appUpdate.progress_pct = progress_pct;
    if (admin_notes !== undefined && admin_notes !== null) appUpdate.admin_notes = admin_notes;
    await dbAsync.update('applications', { id: appId }, { $set: appUpdate });

    const updatedApp = await dbAsync.findOne('applications', { id: appId });

    // Emit live socket update
    io.to('admins').emit('application_updated', updatedApp);
    if (updatedApp?.citizen_id) io.to(`citizen:${updatedApp.citizen_id}`).emit('application_updated', updatedApp);

    res.json({ success: true, application: updatedApp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. CITIZENS DIRECTORY API
app.get('/api/citizens', requireAuth, requireAdmin, async (req, res) => {
  try {
    const citizens = await dbAsync.findMany('users', { role: 'user' }, { sort: { name: 1 }, projection: { _id: 0, id: 1, name: 1, username: 1, email: 1, mobile: 1, village: 1, aadhaar_verified: 1, avatar_url: 1, role: 1, disabled: 1 } });
    res.json(citizens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. MULTI-LINGUAL NLP DIALOG & ASSISTANT CHAT API
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { text, language } = req.body;
    const citizenId = req.auth.user.id;
    const replyObj = await processUserQuery(text, citizenId, dbAsync, language || req.auth.user.language || 'en');
    
    // Save chat messages to MongoDB history.
    const replyText = typeof replyObj === 'string' ? replyObj : replyObj.reply;
    await dbAsync.saveChat({
      user: { citizen_id: citizenId || 'CIT-001', sender: 'user', text, language: language || 'en', timestamp: new Date() },
      assistant: { citizen_id: citizenId || 'CIT-001', sender: 'assistant', text: replyText, language: language || 'en', timestamp: new Date() }
    });

    res.json({ success: true, reply: replyObj, language: language || 'en' });
  } catch (err) {
    console.error("Chat engine error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server after Database Initialization
initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`🌾 Gram Sahayak Rural Portal Active!`);
      console.log(`🔗 Citizen Portal:  http://localhost:${PORT}`);
      console.log(`🛠️  Admin Portal:    http://localhost:${PORT}/admin.html`);
      console.log(`=================================================`);
    });
  })
  .catch(err => {
    console.error("Failed to initialize database:", err);
  });
