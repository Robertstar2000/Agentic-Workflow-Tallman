import { Request, Response, NextFunction } from 'express';
import { getSession } from '../database/init.js';

export interface AuthRequest extends Request {
  userId?: number;
  user?: any;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = session;
    req.userId = session.user_id;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}
