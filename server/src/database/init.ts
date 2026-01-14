import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Simple JSON-based database for user persistence
interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: string;
  created_at: string;
}

interface Workflow {
  id: number;
  user_id: number;
  goal: string;
  state_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Database {
  users: User[];
  sessions: Session[];
  workflows: Workflow[];
}

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Ensure data directory exists
const ensureDataDir = () => {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Load database from file
const loadDb = (): Database => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Failed to load database, starting fresh:', err);
  }
  return { users: [], sessions: [], workflows: [] };
};

// Save database to file
const saveDb = (db: Database) => {
  try {
    ensureDataDir();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed to save database:', err);
  }
};

let db: Database = loadDb();

// Helper functions for database operations
const run = (operation: (db: Database) => any): any => {
  try {
    const result = operation(db);
    saveDb(db);
    return result;
  } catch (err) {
    throw err;
  }
};

const get = (operation: (db: Database) => any): any => {
  return operation(db);
};

const all = (operation: (db: Database) => any[]): any[] => {
  return operation(db);
};

// User management functions
export async function createUser(username: string, email: string, passwordHash: string): Promise<User> {
  const user: User = {
    id: Date.now(), // Simple ID generation
    username,
    email,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };

  run((db) => {
    db.users.push(user);
    return user;
  });

  return user;
}

export async function getUser(email: string): Promise<User | null> {
  return get((db) => db.users.find(u => u.email === email)) || null;
}

export async function getUserById(id: number): Promise<User | null> {
  return get((db) => db.users.find(u => u.id === id)) || null;
}

// Session management functions
export async function createSession(userId: number, sessionToken: string, expiresAt: string): Promise<Session> {
  const session: Session = {
    id: Date.now(),
    user_id: userId,
    session_token: sessionToken,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  };

  run((db) => {
    db.sessions.push(session);
    return session;
  });

  return session;
}

export async function getSession(token: string): Promise<Session | null> {
  return get((db) => db.sessions.find(s => s.session_token === token && new Date(s.expires_at) > new Date())) || null;
}

// Workflow management functions
export async function createWorkflow(userId: number, goal: string, stateJson: string): Promise<Workflow> {
  const workflow: Workflow = {
    id: Date.now(),
    user_id: userId,
    goal,
    state_json: stateJson,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  run((db) => {
    db.workflows.push(workflow);
    return workflow;
  });

  return workflow;
}

export async function updateWorkflow(id: number, stateJson: string, status: string): Promise<void> {
  run((db) => {
    const workflow = db.workflows.find(w => w.id === id);
    if (workflow) {
      workflow.state_json = stateJson;
      workflow.status = status;
      workflow.updated_at = new Date().toISOString();
    }
  });
}

export async function getWorkflows(userId: number): Promise<Workflow[]> {
  return all((db) => db.workflows.filter(w => w.user_id === userId));
}

export async function getWorkflow(id: number): Promise<Workflow | null> {
  return get((db) => db.workflows.find(w => w.id === id)) || null;
}

export async function initDatabase() {
  // Database is initialized automatically when loaded
  // No need for explicit table creation with JSON storage
  console.log('Database initialized with', get((db) => db.users.length), 'users');
}

export { db, run, get, all };
