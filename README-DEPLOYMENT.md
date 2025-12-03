# SAWS Deployment Guide

## Prerequisites
1. **Node.js LTS** - Install from nodejs.org
2. **Ollama** - Download from ollama.ai and install for Windows
3. **PM2** (optional) - `npm install -g pm2`

## Quick Start
1. Run `deploy.bat` to start all services
2. Access the application at `http://localhost:3001`

## Manual Deployment Steps

### 1. Start Ollama
```cmd
ollama serve
ollama pull llama3.1
```

### 2. Start Backend
```cmd
cd server
npm start
```

### 3. Access Application
- Frontend: http://localhost:3200
- API Health: http://localhost:3200/api/health
- Ollama API: http://localhost:11434

## Production Deployment (IIS)

### 1. Install IIS Modules
- Application Request Routing (ARR)
- URL Rewrite

### 2. Configure IIS Site
- Site Name: SuperAgent
- Binding: SuperAgent.tallman.com:80
- Physical Path: C:\inetpub\wwwroot\superagent

### 3. URL Rewrite Rule
- Pattern: `(.*)`
- Rewrite URL: `http://localhost:3200/{R:1}`
- Enable SSL Offloading

### 4. DNS Configuration
Add A Record: SuperAgent.tallman.com -> [Server IP]

## Environment Variables
Edit `server/.env`:
```
JWT_SECRET=your-production-secret-key
PORT=3200
OLLAMA_URL=http://localhost:11434
NODE_ENV=production
```

## Database
SQLite database `saws.db` will be created automatically in the server directory.

## Troubleshooting
- Check Ollama is running: `curl http://localhost:11434/api/tags`
- Check backend health: `curl http://localhost:3200/api/health`
- View logs in server console output