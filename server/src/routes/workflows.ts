import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { createWorkflow, updateWorkflow, getWorkflows, getWorkflow } from '../database/init.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const workflows = await getWorkflows(req.userId!);
    // Sort by created_at descending
    workflows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(workflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { goal, state_json } = req.body;
    const workflow = await createWorkflow(req.userId!, goal, JSON.stringify(state_json));
    res.json({ id: workflow.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const workflow = await getWorkflow(parseInt(req.params.id));
    if (!workflow || workflow.user_id !== req.userId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { state_json, status } = req.body;
    await updateWorkflow(parseInt(req.params.id), JSON.stringify(state_json), status);
    res.json({ message: 'Workflow updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as workflowRoutes };
