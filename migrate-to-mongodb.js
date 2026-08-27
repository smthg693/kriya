require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const sqlitePath = require('path').join(__dirname, 'gram_sahayak.db');
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'gram_sahayak';

function readAll(sqlite, table) {
  return new Promise((resolve, reject) => {
    sqlite.all(`SELECT * FROM ${table}`, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

async function migrate() {
  if (!mongoUri) throw new Error('MONGODB_URI is required.');

  const sqlite = new sqlite3.Database(sqlitePath);
  const client = new MongoClient(mongoUri);
  await client.connect();
  const database = client.db(databaseName);
  const tables = ['citizens', 'admins', 'reports', 'applications', 'chat_messages', 'announcements', 'sessions'];
  const rowsByTable = {};

  for (const table of tables) rowsByTable[table] = await readAll(sqlite, table);

  for (const citizen of rowsByTable.citizens) {
    const { password, ...safeCitizen } = citizen;
    safeCitizen.password_hash = await bcrypt.hash(password || 'user123', 12);
    await database.collection('citizens').updateOne({ id: citizen.id }, { $set: safeCitizen }, { upsert: true });
  }

  for (const admin of rowsByTable.admins) {
    const { password, officer_id, ...safeAdmin } = admin;
    safeAdmin.username = admin.username || (admin.name || 'admin').toLowerCase().replace(/\s+/g, '.');
    safeAdmin.officer_id = officer_id;
    safeAdmin.password_hash = await bcrypt.hash(password || 'admin123', 12);
    await database.collection('admins').updateOne({ id: admin.id }, { $set: safeAdmin }, { upsert: true });
  }

  for (const table of ['reports', 'applications', 'chat_messages', 'announcements']) {
    for (const row of rowsByTable[table]) {
      const key = row.id !== undefined ? { id: row.id } : { token: row.token };
      await database.collection(table).updateOne(key, { $set: row }, { upsert: true });
    }
  }

  for (const session of rowsByTable.sessions) {
    await database.collection('sessions').updateOne({ token: session.token }, { $set: { ...session, expires_at: new Date(session.expires_at) } }, { upsert: true });
  }

  sqlite.close();
  await client.close();
  console.log('Migrated SQLite data to MongoDB:', tables.map(table => `${table}=${rowsByTable[table].length}`).join(', '));
}

migrate().catch(error => {
  console.error('MongoDB migration failed:', error.message);
  process.exitCode = 1;
});
