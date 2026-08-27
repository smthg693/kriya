require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'gram_sahayak';
let client;
let database;

function collection(name) {
  return database.collection(name);
}

function withoutSecrets(user) {
  if (!user) return user;
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.password_hash;
  return safeUser;
}

async function initDatabase() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required. Add it to your environment before starting the server.');
  }

  client = new MongoClient(mongoUri);
  await client.connect();
  database = client.db(databaseName);

  await Promise.all([
    collection('citizens').createIndex({ id: 1 }, { unique: true }),
    collection('citizens').createIndex({ mobile: 1 }, { unique: true }),
    collection('admins').createIndex({ username: 1 }, { unique: true }),
    collection('reports').createIndex({ citizen_id: 1, created_at: -1 }),
    collection('applications').createIndex({ citizen_id: 1, created_at: -1 }),
    collection('sessions').createIndex({ token: 1 }, { unique: true }),
    collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })
  ]);

  await seedInitialData();
}

async function seedInitialData() {
  const citizenPassword = await bcrypt.hash('user123', 12);
  const adminPassword = await bcrypt.hash('admin123', 12);
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

const dbAsync = {
  users: async (role, loginId, password) => {
    const users = collection(role === 'admin' ? 'admins' : 'citizens');
    const filter = role === 'admin'
      ? { $or: [{ username: loginId }, { name: loginId }, { officer_id: loginId }] }
      : { $or: [{ mobile: loginId }, { name: loginId }, { id: loginId }] };
    const user = await users.findOne(filter);
    if (!user || !(await bcrypt.compare(password || '', user.password_hash || ''))) return null;
    return withoutSecrets(user);
  },
  firstUser: async (role) => withoutSecrets(await collection(role === 'admin' ? 'admins' : 'citizens').findOne({})),
  publicUser: async (role, filter) => withoutSecrets(await collection(role === 'admin' ? 'admins' : 'citizens').findOne(filter)),
  findOne: (name, filter) => collection(name).findOne(filter),
  findMany: (name, filter = {}, options = {}) => collection(name).find(filter, options).toArray(),
  insert: (name, document) => collection(name).insertOne(document),
  update: (name, filter, update) => collection(name).updateOne(filter, update),
  remove: (name, filter) => collection(name).deleteOne(filter),
  count: (name, filter = {}) => collection(name).countDocuments(filter),
  saveChat: (document) => collection('chat_messages').insertMany([document.user, document.assistant]),
  close: () => client?.close()
};

module.exports = { initDatabase, dbAsync };
