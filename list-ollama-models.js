/**
 * Script to list available Ollama models on the configured server
 */

const OLLAMA_HOST = 'http://10.10.20.24:11434';

async function listOllamaModels() {
    try {
        console.log(`Connecting to Ollama server at ${OLLAMA_HOST}...\n`);

        const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
            console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
            return;
        }

        const data = await response.json();

        if (!data.models || !Array.isArray(data.models)) {
            console.error('❌ Invalid response format - no models array');
            return;
        }

        console.log(`✅ Found ${data.models.length} model(s):\n`);

        data.models.forEach((model, index) => {
            console.log(`${index + 1}. ${model.name}`);
            if (model.size) {
                const sizeGB = (model.size / (1024 ** 3)).toFixed(2);
                console.log(`   Size: ${sizeGB} GB`);
            }
            if (model.modified_at) {
                const date = new Date(model.modified_at).toLocaleDateString();
                console.log(`   Modified: ${date}`);
            }
            console.log('');
        });

        // Check for specific models
        const hasLlama33 = data.models.some(m => m.name === 'llama3.3:latest');
        console.log(`🔍 Model check:`);
        console.log(`   llama3.3:latest: ${hasLlama33 ? '✅ Available' : '❌ Not found'}`);

        if (!hasLlama33) {
            console.log('\n💡 Available llama3 variants:');
            data.models.filter(m => m.name.includes('llama3'))
                .forEach(m => console.log(`   - ${m.name}`));
        }

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check if Ollama server is running at http://10.10.20.24:11434');
        console.log('2. Verify network connectivity to 10.10.20.24:11434');
        console.log('3. Ensure Ollama has models pulled (ollama pull <model-name>)');
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    listOllamaModels();
}

export { listOllamaModels };
