require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'gram_sahayak';
let client;
let database;

function collection(name) {
  if (!database) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return database.collection(name);
}

function withoutSecrets(user) {
  if (!user) return user;
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.password_hash;
  return safeUser;
}

async function initDatabase(retries = 5, delay = 3000) {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required. Add it to your .env file or environment before starting the server.');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000, retryWrites: true });
      await client.connect();
      database = client.db(databaseName);
      console.log(`✅ Successfully connected to MongoDB database: ${databaseName} (Attempt ${attempt})`);
      break;
    } catch (err) {
      console.error(`⚠️ MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Drop old sparse indexes if they exist to upgrade to partial filter expressions
  const oldIndexesToDrop = [
    { coll: 'users', name: 'email_1' },
    { coll: 'users', name: 'mobile_1' },
    { coll: 'citizens', name: 'mobile_1' }
  ];
  for (const idx of oldIndexesToDrop) {
    try {
      await collection(idx.coll).dropIndex(idx.name);
    } catch (e) {
      // Ignore if index doesn't exist or already dropped
    }
  }

  // Clean up any test documents from previous runs
  try {
    await collection('users').deleteMany({ id: { $regex: /^CIT-TEST-/ } });
    await collection('citizens').deleteMany({ id: { $regex: /^CIT-TEST-/ } });
  } catch (e) {}

  // Create robust performance and uniqueness indexes with partial filter expressions
  await Promise.all([
    collection('users').createIndex({ username: 1 }, { unique: true }),
    collection('users').createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }),
    collection('users').createIndex({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: 'string' } } }),
    collection('citizens').createIndex({ id: 1 }, { unique: true }),
    collection('citizens').createIndex({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: 'string' } } }),
    collection('admins').createIndex({ username: 1 }, { unique: true }),
    collection('reports').createIndex({ citizen_id: 1, created_at: -1 }),
    collection('reports').createIndex({ id: 1 }, { unique: true }),
    collection('applications').createIndex({ citizen_id: 1, created_at: -1 }),
    collection('applications').createIndex({ id: 1 }, { unique: true }),
    collection('sessions').createIndex({ token: 1 }, { unique: true }),
    collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })
  ]);

  await seedInitialData();
  await syncLegacyUsers();
}

async function seedInitialData() {
  // Use env-configured passwords so plaintext never lives in source code.
  // Defaults are intentionally obvious – operators MUST set these in .env.
  const citizenPw = process.env.SEED_CITIZEN_PASSWORD || 'GramUser@2025!';
  const adminPw   = process.env.SEED_ADMIN_PASSWORD   || 'GramAdmin@2025!';
  const citizenPassword = await bcrypt.hash(citizenPw, 12);
  const adminPassword   = await bcrypt.hash(adminPw, 12);
  const citizenDefaults = [
    { id: 'CIT-001', name: 'Rajesh Kumar', mobile: '9876543210', village: 'Kalyanpur', language: 'en' },
    { id: 'CIT-002', name: 'Sunita Devi', mobile: '9876543211', village: 'Kalyanpur', language: 'hi' }
  ];

  for (const citizen of citizenDefaults) {
    await collection('citizens').updateOne(
      { id: citizen.id },
      { $setOnInsert: { ...citizen, password_hash: citizenPassword, aadhaar_verified: 1, role: 'citizen', created_at: new Date() } },
      { upsert: true }
    );
  }

  await collection('admins').updateOne(
    { id: 'ADM-001' },
    { $setOnInsert: { id: 'ADM-001', username: 'ramesh.kumar', name: 'Ramesh Kumar', village: 'Kalyanpur', designation: 'Gram Panchayat Secretary', password_hash: adminPassword, role: 'admin', created_at: new Date() } },
    { upsert: true }
  );
}

async function syncLegacyUsers() {
  const [citizens, admins] = await Promise.all([
    collection('citizens').find({}).toArray(),
    collection('admins').find({}).toArray()
  ]);
  const users = [
    ...citizens.map(user => ({ ...user, username: user.username || user.mobile, role: 'user' })),
    ...admins.map(user => ({ ...user, username: user.username || (user.name || 'admin').toLowerCase().replace(/\s+/g, '.'), role: 'admin' }))
  ];
  for (const user of users) {
    const { password, _id, ...userWithoutPassword } = user;
    const update = { ...userWithoutPassword };
    if (!update.email) delete update.email;
    if (!update.mobile) delete update.mobile;
    await collection('users').updateOne(
      { id: user.id },
      { $set: update, $unset: { password: '', ...(user.email ? {} : { email: '' }), ...(user.mobile ? {} : { mobile: '' }) } },
      { upsert: true }
    );
  }
}

const dbAsync = {
  users: async (role, loginId, password) => {
    const users = collection(role === 'admin' ? 'admins' : 'citizens');
    const filter = role === 'admin'
      ? { $or: [{ username: loginId }, { officer_id: loginId }] }
      : { $or: [{ username: loginId }, { email: loginId }, { mobile: loginId }, { id: loginId }] };
    const user = await users.findOne(filter);
    if (!user || !(await bcrypt.compare(password || '', user.password_hash || ''))) return null;
    return withoutSecrets(user);
  },
  firstUser: async (role) => withoutSecrets(await collection(role === 'admin' ? 'admins' : 'citizens').findOne({})),
  publicUser: async (role, filter) => withoutSecrets(await collection(role === 'admin' ? 'admins' : 'citizens').findOne(filter)),
  findUserByLogin: async (loginId, password) => {
    const user = await collection('users').findOne({ $or: [{ username: loginId }, { email: loginId }, { mobile: loginId }, { name: loginId }] });
    if (!user || user.disabled || !(await bcrypt.compare(password || '', user.password_hash || ''))) return null;
    return withoutSecrets(user);
  },
  findUserById: async (id) => withoutSecrets(await collection('users').findOne({ $or: [{ id }, { _id: id }] })),
  insertUser: async (user) => {
    const cleanUser = { ...user };
    if (!cleanUser.mobile || typeof cleanUser.mobile !== 'string' || !cleanUser.mobile.trim()) delete cleanUser.mobile;
    if (!cleanUser.email || typeof cleanUser.email !== 'string' || !cleanUser.email.trim()) delete cleanUser.email;
    await collection('users').insertOne(cleanUser);
    
    // Also sync to legacy citizens collection
    const citizenDoc = { ...cleanUser };
    delete citizenDoc._id;
    await collection('citizens').updateOne({ id: cleanUser.id }, { $set: citizenDoc }, { upsert: true });
    return cleanUser;
  },
  updateUser: (id, update) => collection('users').updateOne({ _id: id }, update),
  deleteUser: async (id) => {
    await collection('users').deleteOne({ id });
    await collection('citizens').deleteOne({ id });
  },
  listUsers: () => collection('users').find({}, { projection: { password_hash: 0, password: 0 } }).sort({ created_at: -1 }).toArray(),
  findSession: (token) => collection('sessions').findOne({ token, expires_at: { $gt: new Date() } }),
  findOne: (name, filter) => collection(name).findOne(filter),
  findMany: (name, filter = {}, options = {}) => {
    const { sort, limit, skip, projection } = options;
    let cursor = collection(name).find(filter, { projection });
    if (sort) cursor = cursor.sort(sort);
    if (skip) cursor = cursor.skip(skip);
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
  },
  insert: (name, document) => collection(name).insertOne(document),
  update: (name, filter, update) => collection(name).updateOne(filter, update),
  remove: (name, filter) => collection(name).deleteOne(filter),
  count: (name, filter = {}) => collection(name).countDocuments(filter),
  saveChat: (document) => {
    const docs = Array.isArray(document)
      ? document
      : (document.user && document.assistant ? [document.user, document.assistant] : [document]);
    return collection('chatHistory').insertMany(docs);
  },
  close: () => client?.close()
};

module.exports = { initDatabase, dbAsync };
