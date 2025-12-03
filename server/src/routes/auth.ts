import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { run, get } from '../database/init.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashedPassword]);
    res.json({ message: 'User registered successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get('SELECT * FROM users WHERE username = ?', [username]) as any;
    
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as authRoutes };