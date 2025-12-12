import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/generate', async (req, res) => {
  try {
    const { prompt, model = process.env.MODEL || 'llama3.2', ...options } = req.body;

    const ollamaResponse = await axios.post(`${process.env.OLLAMA_URL}/api/generate`, {
      model,
      prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.7,
        num_ctx: 15000,
        ...options
      }
    }, {
      // align with frontend extended timeouts: 500s first attempt, 1000s retry at proxy level
      timeout: 1000000, // 1000 seconds
      validateStatus: (status) => status >= 200 && status < 500 // surface 4xx in response data
    });

    res.json(ollamaResponse.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const serverMsg = error.response?.data || error.message || 'Unknown error';
    console.error('Ollama error:', serverMsg);
    res.status(status >= 400 && status < 600 ? status : 500).json({ 
      error: 'AI service unavailable', 
      details: serverMsg,
      hint: 'The AI request exceeded the server timeout or returned an error. Consider reducing prompt size or retrying.'
    });
  }
});

export { router as aiRoutes };
