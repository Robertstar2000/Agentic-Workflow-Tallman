import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/generate', async (req, res) => {
  try {
    const { prompt, model = 'llama3.2', ...options } = req.body;
    
    const ollamaResponse = await axios.post(`${process.env.OLLAMA_URL}/api/generate`, {
      model,
      prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.7,
        num_ctx: 4096,
        ...options
      }
    }, {
      timeout: 60000
    });

    res.json(ollamaResponse.data);
  } catch (error: any) {
    console.error('Ollama error:', error.message);
    res.status(500).json({ 
      error: 'AI service unavailable', 
      details: error.response?.data || error.message 
    });
  }
});

export { router as aiRoutes };