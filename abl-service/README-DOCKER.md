# ABL Service Docker Setup

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js (for local development)

### Docker Orchestration

```bash
# 1. Start all services (database + backend + frontend with hot reload)
npm run docker:up

# 2. View logs (optional)
npm run docker:logs

# 3. Stop all services
npm run docker:down

# 4. Rebuild containers (if you change dependencies)
npm run docker:build && npm run docker:up
```

## 📊 Services

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| **Frontend** | http://localhost:3200 | 3200 | Next.js app with hot reload |
| **Backend** | http://localhost:8101 | 8101 | Express.js API with hot reload |
| **Database** | localhost:5434 | 5434 | PostgreSQL database |

## 🔄 Hot Reload Features

### Frontend (Next.js)
- Any changes to `/app`, `/components`, `/lib` folders trigger automatic reload
- Fast refresh enabled for React components
- TypeScript compilation on the fly

### Backend (Express.js)
- Any changes to `/server` folder trigger automatic restart
- Nodemon watches for file changes
- Database connection maintained across restarts

## 🗃️ Database

### Initial Setup
- Database automatically created with tables and sample data
- Tables: `accounts`, `ilp_active_accounts`
- Sample accounts pre-loaded for testing

### Connection Details
```
Host: localhost
Port: 5434
Database: abl_cbs
Username: postgres
Password: postgres
```

### Data Persistence
- Data persists in Docker volume `abl_postgres_data`
- To reset database: `docker-compose down -v && npm run docker:up`

## 🛠️ Development Workflow

### 1. Start Development Environment
```bash
npm run docker:up
```

### 2. Make Changes
- Edit frontend files → Changes reflect immediately at http://localhost:3200
- Edit backend files → Server restarts automatically
- Database schema changes → Update `init.sql` and restart

### 3. View Application
- Open http://localhost:3200
- Test the 4-step workflow:
  1. Create Account
  2. View Accounts
  3. Account Details
  4. Create Wallet Address

## 📝 Available Scripts

```bash
# Docker commands
npm run docker:up      # Start all services
npm run docker:down    # Stop all services  
npm run docker:build   # Rebuild containers
npm run docker:logs    # View logs

# Local development (without Docker)
npm run dev:backend    # Start backend only
npm run dev:frontend   # Start frontend only
npm run dev:local      # Start both locally

# Production
npm run build          # Build for production
npm run start          # Start production server
```

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker ps | grep abl-postgres

# Check database logs
docker logs abl-postgres

# Reset database
docker-compose down -v && npm run docker:up
```

### Port Conflicts
If ports are in use, update `docker-compose.yml`:
- Frontend: Change `3200:3000` to `XXXX:3000`
- Backend: Change `8101:8101` to `XXXX:8101`
- Database: Change `5434:5432` to `XXXX:5432`

### Hot Reload Not Working
```bash
# Rebuild containers
npm run docker:build && npm run docker:up

# Check file permissions
sudo chown -R $USER:$USER .
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │    │   (Express.js)  │    │   (PostgreSQL)  │
│   Port: 3200    │────│   Port: 8101    │────│   Port: 5434    │
│   Hot Reload ✅ │    │   Hot Reload ✅ │    │   Persistent ✅ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔗 Integration with Rafiki

The ABL service integrates with Rafiki (Happy Life Bank) for ILP functionality:
- Assets fetched from: `http://localhost:4001/graphql`
- Wallet addresses created via Rafiki GraphQL API
- HMAC authentication for secure communication

Make sure Rafiki services are running for full functionality!
