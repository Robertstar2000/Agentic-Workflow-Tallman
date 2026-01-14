import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { generateResponse } from '../geminiService.js';

const router = express.Router();

// Optional authentication - allow internal calls without auth
router.use((req, res, next) => {
  // Check if this is an internal call (no Authorization header)
  if (!req.headers.authorization) {
    return next(); // Skip authentication for internal calls
  }
  // Use authentication for external calls
  return authenticateToken(req, res, next);
});

// Internet search endpoint - searches DuckDuckGo AND Wikipedia from backend to avoid CORS
// Returns 8 snippets from each source (16 total)
router.post('/test-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Search DuckDuckGo
    const duckduckgoUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
    
    // Search Wikipedia
    const wikipediaUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=8`;
    
    // Execute both searches in parallel
    const [ddgResponse, wikiResponse] = await Promise.allSettled([
      fetch(duckduckgoUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'TallmanSuperAgent/1.0'
        },
        signal: AbortSignal.timeout(12000)
      }),
      fetch(wikipediaUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'TallmanSuperAgent/1.0'
        },
        signal: AbortSignal.timeout(12000)
      })
    ]);

    // Process DuckDuckGo results
    let duckduckgoResults: { text: string; url: string; source: string }[] = [];
    let abstract: { text: string; url: string } | null = null;
    
    if (ddgResponse.status === 'fulfilled') {
      try {
        const contentType = ddgResponse.value.headers.get('content-type') || '';
        if (contentType.includes('application/json') || contentType.includes('text/javascript')) {
          const ddgText = await ddgResponse.value.text();
          const ddgData = JSON.parse(ddgText);
          const related = Array.isArray(ddgData.RelatedTopics) ? ddgData.RelatedTopics : [];
          
          duckduckgoResults = related
            .flatMap((item: any) => {
              if (item?.Text && item?.FirstURL) {
                return [{ text: item.Text, url: item.FirstURL, source: 'DuckDuckGo' }];
              }
              if (Array.isArray(item?.Topics)) {
                return item.Topics.map((t: any) => t?.Text && t?.FirstURL ? { text: t.Text, url: t.FirstURL, source: 'DuckDuckGo' } : null).filter(Boolean);
              }
              return [];
            })
            .filter(Boolean)
            .slice(0, 8);
          
          if (ddgData.Abstract) {
            abstract = { text: ddgData.Abstract, url: ddgData.AbstractURL || '' };
          }
        } else {
          console.log('DuckDuckGo returned non-JSON content-type:', contentType);
        }
      } catch (parseErr) {
        console.error('DuckDuckGo parse error:', parseErr);
      }
    } else {
      console.error('DuckDuckGo request failed:', ddgResponse.reason);
    }

    // Process Wikipedia results
    let wikipediaResults: { text: string; url: string; source: string }[] = [];
    
    if (wikiResponse.status === 'fulfilled') {
      try {
        const contentType = wikiResponse.value.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const wikiText = await wikiResponse.value.text();
          const wikiData = JSON.parse(wikiText);
          const searchResults = wikiData?.query?.search || [];
          
          wikipediaResults = searchResults.slice(0, 8).map((item: any) => ({
            text: `${item.title}: ${item.snippet.replace(/<[^>]*>/g, '')}...`,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            source: 'Wikipedia'
          }));
        } else {
          console.log('Wikipedia returned non-JSON content-type:', contentType);
        }
      } catch (parseErr) {
        console.error('Wikipedia parse error:', parseErr);
      }
    } else {
      console.error('Wikipedia request failed:', wikiResponse.reason);
    }

    // Combine results
    const allResults = [...duckduckgoResults, ...wikipediaResults];
    
    res.json({ 
      results: allResults,
      duckduckgoCount: duckduckgoResults.length,
      wikipediaCount: wikipediaResults.length,
      abstract,
      query 
    });
  } catch (error: any) {
    console.error('Search error:', error.message);
    res.status(500).json({ 
      error: 'Search failed', 
      details: error.message 
    });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.0-flash-exp', ...options } = req.body;

    const response = await generateResponse(prompt, model);
    res.json({ response });
  } catch (error: any) {
    console.error('Gemini error:', error);
    res.status(500).json({
      error: 'AI service unavailable',
      details: error.message || 'Unknown error',
      hint: 'The AI request failed. Please try again.'
    });
  }
});

export { router as aiRoutes };
