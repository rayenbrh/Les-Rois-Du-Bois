# Deployment (Easypanel / Docker)

The project runs as **two services**, each with its own Dockerfile:

| Service | Build path | Port | Dockerfile |
|---------|-----------|------|------------|
| API (Express + MongoDB) | `./backend` | `5000` | `backend/Dockerfile` |
| Web app (store, admin, commercial, POS) | `./frontend` | `3000` | `frontend/Dockerfile` |

## Easypanel setup

### API service
- Source: this repository, **build path `/backend`**, builder: Dockerfile.
- Environment variables:
  ```env
  NODE_ENV=production
  PORT=5000
  MONGO_URI=mongodb://user:pass@host:27017/les-rois-des-bois   # or MONGODB_URI
  JWT_SECRET=a-long-random-secret          # do NOT change it, or everybody is logged out
  FRONTEND_URL=https://your-frontend-domain   # comma separated if several
  ```
  `JWT_EXPIRES_IN` / `JWT_EXPIRE` are no longer used: sessions never expire,
  users stay logged in until they log out (or their password is changed).
- **Volume:** mount a persistent volume at **`/app/uploads`** (product, category and settings images).
- Health check: `GET /api/health` (answers even while MongoDB reconnects).

### Web service
- Source: this repository, **build path `/frontend`**, builder: Dockerfile.
- Build argument: `VITE_API_URL=https://your-api-domain/api`
- Environment: `PORT=3000` (Easypanel proxies to it).

## Local run with docker compose

```bash
cp backend/.env.example backend/.env   # fill in the values above
VITE_API_URL=http://localhost:5000/api docker compose up -d --build
```

- Web app: http://localhost:3000
- API: http://localhost:5000/api/health

## Notes
- The first admin account can be created with `npm run create-admin` (backend) or
  `POST /api/auth/register` – this endpoint only works while **no admin exists**.
- Deployments are safe for open browsers: the service worker always fetches the
  latest `index.html`, and a page that requests an old bundle reloads itself once.
