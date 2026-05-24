# Muse

Muse is a real-time music challenge game with a Go/PocketBase backend and a Next.js frontend.

## Stack

- Backend: Go 1.26, PocketBase
- Frontend: Next.js 16, React 19, TypeScript
- Package manager: npm

## Local Setup

Start the backend:

```bash
cd backend
go mod download
go run . serve --http=127.0.0.1:8090
```

Create an admin user with your own strong password:

```bash
cd backend
go run . superuser upsert admin@example.com "replace-with-a-strong-password"
```

Start the frontend:

```bash
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Environment

The frontend reads `NEXT_PUBLIC_POCKETBASE_URL`.

For local development:

```env
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
```

For production, set it to the public HTTPS URL for the backend.

```env
NEXT_PUBLIC_POCKETBASE_URL=https://api.muse.edbn.me
```

## Deployment Notes

The frontend can be deployed to Vercel as a Next.js app from the `frontend` directory.

The backend stores PocketBase state on disk, so production hosting must provide persistent storage for `pb_data`. Do not deploy production PocketBase data from a local development folder.

### Backend Auto-Deploy

This repo includes `.github/workflows/deploy-backend.yml`. On pushes to `main` that touch backend files, GitHub Actions builds the Go/PocketBase binary, copies it to the droplet, installs a systemd service, and restarts it.

Required GitHub repository secrets:

```env
DO_DROPLET_HOST=<droplet SSH host>
DO_DROPLET_USER=root
DO_SSH_PRIVATE_KEY=<private deploy key authorized on the droplet>
MUSE_HTTP=127.0.0.1:8090
MUSE_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://muse.edbn.me,https://*.vercel.app
BACKEND_HEALTH_URL=https://api.muse.edbn.me/api/muse/health
```

Set `BACKEND_EXTERNAL_HEALTH_REQUIRED=true` after DNS and TLS are fully active if the GitHub Actions deploy should fail when the public domain health check fails.

Optional bootstrap-only secrets for creating or rotating the PocketBase superuser:

```env
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=<long random password>
```

Runtime config lives in `/etc/muse/backend.env` on the droplet. PocketBase data is stored in `/var/lib/muse/pb_data`.

The production backend binds to loopback and is exposed through Caddy at `https://api.muse.edbn.me`.

A Caddy reverse proxy example is available at `backend/deploy/Caddyfile.example`.

## License

No open-source license has been selected yet. Add a `LICENSE` file before accepting outside contributions.
