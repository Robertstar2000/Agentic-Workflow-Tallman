# Tallman Super Agent - Self-Contained Docker Deployment

This application is designed to run completely self-contained in Docker containers without requiring any external IDE, development environment, or additional dependencies.

## 🚀 Quick Start

### Prerequisites
- Docker (version 20.10 or later)
- docker-compose (version 1.29 or later)
- At least 4GB RAM available
- Ports 3250 and 3251 available on the host

### One-Command Deployment

```bash
# Clone or navigate to the project directory
cd Tallman-Super-Agent

# Start the application (Linux/Mac)
./start.sh

# Or manually with docker-compose
docker-compose up --build -d
```

## 🏗️ Architecture

The application runs in two self-contained Docker containers:

### Frontend Container
- **Base**: nginx:alpine
- **Port**: 3250 (external) → 80 (internal)
- **Features**:
  - Serves React application
  - Health checks included
  - Non-root user for security
  - Automatic restarts on failure

### Backend Container
- **Base**: node:18
- **Port**: 3251 (external) → 3231 (internal)
- **Features**:
  - Node.js API server
  - SQLite database (file-based, no external DB required)
  - Gemini AI integration
  - LocalAI/Granite fallback
  - Health checks included
  - Non-root user for security
  - Automatic restarts on failure

## 📋 Environment Configuration

All configuration is contained in `.env.docker`:

```env
# Gemini AI Configuration
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Granite Fallback (LocalAI)
GRANITE_API_URL=http://host.docker.internal:12434/v1/chat/completions

# Application Settings
PORT=3231
JWT_SECRET=your_secure_jwt_secret

# Database (SQLite - no external setup required)
# Database file is created automatically in container
```

## 🔧 Manual Operations

### Start Services
```bash
docker-compose up --build -d
```

### Check Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services
```bash
docker-compose down
```

### Health Checks
```bash
# Backend health
curl http://localhost:3251/api/health

# Frontend availability
curl http://localhost:3250
```

## 🔒 Security Features

- **Non-root containers**: Both frontend and backend run as non-privileged users
- **Health checks**: Automatic monitoring and restart on failures
- **Environment isolation**: All secrets stored in environment variables
- **Minimal attack surface**: Alpine Linux base images

## 📊 Monitoring

### Container Health
```bash
docker stats
```

### Application Logs
```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

## 🚨 Troubleshooting

### Backend Won't Start
```bash
# Check backend logs
docker-compose logs backend

# Check health endpoint
curl http://localhost:3251/api/health
```

### Frontend Not Loading
```bash
# Check frontend logs
docker-compose logs frontend

# Check if port 3250 is available
netstat -an | find "3250"
```

### AI Services Failing
- Ensure `.env.docker` has valid `GEMINI_API_KEY`
- Check if LocalAI container is running on port 12434
- Verify network connectivity between containers

### Port Conflicts
- Change ports in `docker-compose.yml` if 3250/3251 are in use
- Update any hardcoded URLs in the application accordingly

## 🔄 Updates

To update the application:
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

## 🗂️ Self-Contained Features

✅ **No external dependencies**: Everything runs in containers
✅ **Database included**: SQLite database created automatically
✅ **AI services configured**: Gemini primary, Granite fallback
✅ **Health monitoring**: Automatic restarts and health checks
✅ **Security hardened**: Non-root users, minimal permissions
✅ **Production ready**: Restart policies, logging, monitoring

## 🌐 Access Points

- **Web Application**: http://localhost:3250
- **API Documentation**: http://localhost:3251/api/health
- **Backend Health**: http://localhost:3251/api/health

## 📞 Support

The application is designed to be completely self-contained. If issues persist:

1. Check logs: `docker-compose logs -f`
2. Verify environment: `cat .env.docker`
3. Check container status: `docker-compose ps`
4. Restart services: `docker-compose restart`

No IDE or development environment required - everything runs in Docker!
