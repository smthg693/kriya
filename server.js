const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { initDatabase, dbAsync } = require('./database');
const { processUserQuery } = require('./nlp_engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
const upload = multer({ storage });

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// WebSockets Setup
io.on('connection', (socket) => {
  console.log('Client connected to WebSockets:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
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

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== REST API ENDPOINTS ==================== //

// 1. AUTHENTICATION (Database-backed Session Auth)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { loginId, password, role } = req.body;
    let user;
    if (role === 'admin') {
      user = await dbAsync.users('admin', loginId, password);
    } else {
      user = await dbAsync.users('citizen', loginId, password);
    }

    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await dbAsync.insert('sessions', { token, user_id: user.id, role: user.role, expires_at: new Date(expiresAt), created_at: new Date() });

    return res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, mobile, village, password } = req.body;
    const existing = await dbAsync.findOne('citizens', { mobile });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Mobile number is already registered!' });
    }

    const newId = 'CIT-' + Math.floor(100 + Math.random() * 900);
    const defaultAvatar = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPRc6GYVwSy_AKt35qAxkHsARWBl5vkCni8miFTxQR8qgHr2_JKmagVvtoyYpYeUXR33tu82w316-dtwxbBRrYb47oHQ2ZW--l_X2XL7RruFntCX-8Ly_gxGrZpHIn0Qhd8TvmLd6tk__mqLTCNrmGanbMBa6JUzvaQyEU1sKWj_nJT5Bt88ga-VgUhVIjAdAE7EQolO9zNeDp-yH6WtskdaUO-C9WE-TR55b5NZBd7VZuVE421Sj6-g';

    const passwordHash = await require('bcryptjs').hash(password || 'user123', 12);
    await dbAsync.insert('citizens', { id: newId, name, mobile, village: village || 'Kalyanpur', password_hash: passwordHash, aadhaar_verified: 1, avatar_url: defaultAvatar, role: 'citizen', language: 'en', created_at: new Date() });

    const user = await dbAsync.publicUser('citizen', { id: newId });
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await dbAsync.insert('sessions', { token, user_id: user.id, role: user.role, expires_at: new Date(expiresAt), created_at: new Date() });

    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization || req.body.token;
    if (token) {
      await dbAsync.remove('sessions', { token });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = await dbAsync.findOne('sessions', { token, expires_at: { $gt: new Date() } });
    if (!session) return res.status(401).json({ success: false, error: 'Session expired' });

    let user;
    if (session.role === 'admin') {
      user = await dbAsync.publicUser('admin', { id: session.user_id });
    } else {
      user = await dbAsync.publicUser('citizen', { id: session.user_id });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. DASHBOARD STATS
app.get('/api/stats', async (req, res) => {
  try {
    const [activeReports, resolvedReports, criticalEmergencies, totalCitizens, pendingApplications] = await Promise.all([
      dbAsync.count('reports', { status: { $ne: 'Resolved' } }),
      dbAsync.count('reports', { status: 'Resolved' }),
      dbAsync.count('reports', { priority: 'Critical', status: { $ne: 'Resolved' } }),
      dbAsync.count('citizens'),
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
app.get('/api/reports', async (req, res) => {
  try {
    const { status, category, citizenId } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (category && category !== 'All') filter.category = category;
    if (citizenId) filter.citizen_id = citizenId;
    const reports = await dbAsync.findMany('reports', filter, { sort: { created_at: -1 } });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports', upload.single('photo'), async (req, res) => {
  try {
    const { category, location, description, citizen_id, citizen_name } = req.body;
    const repNum = Math.floor(100 + Math.random() * 900);
    const reportId = `#REP-${repNum}`;
    const priority = detectPriority(description || '', category || '');
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    await dbAsync.insert('reports', { id: reportId, category: category || 'General', location: location || 'Panchayat Area', description: description || 'Issue reported', photo_url, status: 'Pending', priority, citizen_id: citizen_id || 'CIT-001', citizen_name: citizen_name || 'Rajesh Kumar', date: todayStr, created_at: new Date(), updated_at: new Date() });

    const newReport = await dbAsync.findOne('reports', { id: reportId });

    // Broadcast live event to all clients / admins!
    io.emit('report_created', newReport);

    res.json({ success: true, report: newReport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/reports/:id/status', async (req, res) => {
  try {
    const reportId = req.params.id;
    const { status, admin_notes } = req.body;

    const reportUpdate = { status, updated_at: new Date() };
    if (admin_notes !== undefined && admin_notes !== null) reportUpdate.admin_notes = admin_notes;
    await dbAsync.update('reports', { id: reportId }, { $set: reportUpdate });

    const updatedReport = await dbAsync.findOne('reports', { id: reportId });

    // Emit live WebSocket update to citizens and admins!
    io.emit('report_updated', updatedReport);

    res.json({ success: true, report: updatedReport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. SCHEME APPLICATIONS API
app.get('/api/applications', async (req, res) => {
  try {
    const { citizenId } = req.query;
    const apps = await dbAsync.findMany('applications', citizenId ? { citizen_id: citizenId } : {}, { sort: { created_at: -1 } });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const { scheme_type, citizen_id, citizen_name, details } = req.body;
    const appNum = Math.floor(1000 + Math.random() * 9000);
    const appId = `#APP-2023-${appNum}`;

    await dbAsync.insert('applications', { id: appId, scheme_type: scheme_type || 'General Scheme', citizen_id: citizen_id || 'CIT-001', citizen_name: citizen_name || 'Rajesh Kumar', status: 'Submitted', progress_pct: 25, details_json: JSON.stringify(details || {}), created_at: new Date(), updated_at: new Date() });

    const newApp = await dbAsync.findOne('applications', { id: appId });

    // Emit live socket event
    io.emit('application_submitted', newApp);

    res.json({ success: true, application: newApp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/applications/:id/status', async (req, res) => {
  try {
    const appId = req.params.id;
    const { status, progress_pct, admin_notes } = req.body;

    const appUpdate = { status, updated_at: new Date() };
    if (progress_pct !== undefined && progress_pct !== null) appUpdate.progress_pct = progress_pct;
    if (admin_notes !== undefined && admin_notes !== null) appUpdate.admin_notes = admin_notes;
    await dbAsync.update('applications', { id: appId }, { $set: appUpdate });

    const updatedApp = await dbAsync.findOne('applications', { id: appId });

    // Emit live socket update
    io.emit('application_updated', updatedApp);

    res.json({ success: true, application: updatedApp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. CITIZENS DIRECTORY API
app.get('/api/citizens', async (req, res) => {
  try {
    const citizens = await dbAsync.findMany('citizens', {}, { sort: { name: 1 }, projection: { _id: 0, id: 1, name: 1, mobile: 1, village: 1, aadhaar_verified: 1, avatar_url: 1, role: 1 } });
    res.json(citizens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. MULTI-LINGUAL NLP DIALOG & ASSISTANT CHAT API
app.post('/api/chat', async (req, res) => {
  try {
    const { text, citizenId, language } = req.body;
    const replyObj = await processUserQuery(text, citizenId, dbAsync, language || 'en');
    
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
