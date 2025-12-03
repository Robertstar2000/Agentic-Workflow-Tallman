@echo off
echo Starting SAWS Deployment...

echo.
echo 1. Starting Ollama service...
start /B ollama serve

echo.
echo 2. Pulling Llama 3.1 model...
ollama pull llama3.1

echo.
echo 3. Starting backend server...
cd server
start /B npm start

echo.
echo 4. Deployment complete!
echo.
echo Backend running on: http://localhost:3200
echo Frontend served from: http://localhost:3200
echo Ollama API: http://localhost:11434
echo.
echo To stop services:
echo - Press Ctrl+C in this window
echo - Run: taskkill /f /im node.exe
echo - Run: taskkill /f /im ollama.exe
pause