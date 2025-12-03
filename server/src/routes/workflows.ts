import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { run, get, all } from '../database/init.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const workflows = await all('SELECT * FROM workflows WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    res.json(workflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { goal, state_json } = req.body;
    const result = await run('INSERT INTO workflows (user_id, goal, state_json) VALUES (?, ?, ?)', 
      [req.userId, goal, JSON.stringify(state_json)]);
    res.json({ id: (result as any).lastID });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const workflow = await get('SELECT * FROM workflows WHERE id = ? AND user_id = ?', 
      [req.params.id, req.userId]);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { state_json, status } = req.body;
    await run('UPDATE workflows SET state_json = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', 
      [JSON.stringify(state_json), status, req.params.id, req.userId]);
    res.json({ message: 'Workflow updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as workflowRoutes };