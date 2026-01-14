import { useState } from 'react'
import './App.css'
import { generateResponse } from '../utils/geminiService'

function App() {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await generateResponse(prompt)
      setResponse(result)
    } catch (error) {
      setResponse('Error: ' + (error as Error).message)
    }
    setLoading(false)
  }

  return (
    <div className="app">
      <h1>Tallman Super Agent with Gemini</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          rows={4}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Response'}
        </button>
      </form>
      {response && (
        <div className="response">
          <h2>Response:</h2>
          <p>{response}</p>
        </div>
      )}
    </div>
  )
}

export default App
