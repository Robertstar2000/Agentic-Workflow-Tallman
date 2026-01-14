import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const generateResponse = async (prompt: string, modelName?: string) => {
  try {
    // Primary: Gemini
    const model = genAI.getGenerativeModel({ model: modelName || process.env.GEMINI_MODEL || 'gemini-1.5-pro' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    console.error('Gemini API error:', error);
    try {
      // Secondary: Docker Granite model via LocalAI
      const graniteUrl = process.env.GRANITE_API_URL || 'http://host.docker.internal:12434/v1/chat/completions';
      const response = await fetch(graniteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'ibm-granite_granite-4.0-h-tiny',
          messages: [{ role: 'user', content: prompt }],
          stream: false
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Granite response';
      }
      throw new Error(`Granite API failed: ${response.status} ${response.statusText}`);
    } catch (graniteError: any) {
      console.error('Granite failed:', graniteError);
      throw new Error(`All LLM services failed. Gemini: ${error.message || 'Unknown error'}. Granite: ${graniteError.message || 'Unknown error'}`);
    }
  }
};
