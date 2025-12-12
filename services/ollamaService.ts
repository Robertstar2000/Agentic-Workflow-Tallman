/**
 * Ollama service configuration
 * Centralized configuration for Ollama AI model integration
 */

export const OLLAMA_CONFIG = {
    host: 'http://10.10.20.24:11434',
    model: 'llama3.3:latest',
    // Raised context/token limit per request
    maxTokens: 15000,
};

/**
 * Test connectivity to the Ollama server
 * @returns Promise<boolean> - True if the server responds with 200
 */
export const testOllamaConnection = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${OLLAMA_CONFIG.host}/api/tags`);
        return response.ok;
    } catch (error) {
        console.error('Ollama connection test failed:', error);
        return false;
    }
};

/**
 * Get a simple response from Ollama to verify model availability
 * @param prompt - Test prompt
 * @returns Promise<string> - The response content or error message
 */
export const testOllamaModel = async (prompt: string = 'Hello'): Promise<string> => {
    try {
        const response = await fetch(`${OLLAMA_CONFIG.host}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_CONFIG.model,
                prompt,
                stream: false,
                format: 'json',
                options: {
                    temperature: 0.7,
                    num_ctx: 4096,
                },
            }),
            signal: AbortSignal.timeout(60000), // 60 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response || 'No response content';
    } catch (error) {
        console.error('Ollama model test failed:', error);
        return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
};
