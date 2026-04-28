# Medium

**Make contact.** A self-hosted, single-server chat platform with real-time text channels, voice channels, file sharing, and more. Designed to run on a Raspberry Pi behind a reverse proxy.

---

## What is this?

Medium is a chat app you host yourself. You get:

- **Text channels** — real-time messaging with Markdown, emoji reactions, replies, @mentions, link previews, and file attachments
- **Voice channels** — WebRTC-based voice chat with speaking indicators, mute/deafen, and noise gate
- **Private channels** — password-protected channels that keep their messages forever
- **Rich media** — image previews (with NSFW blur), inline text file viewer, GIF picker, video and audio uploads
- **User profiles** — avatars, banners, bios, and accent colors
- **Search** — full-text search across all channels (Ctrl+K)
- **Themes** — dark, light, and custom color themes
- **Settings** — notification preferences, voice input modes, noise gate tuning

Everything runs in Docker. No external database needed — it uses SQLite under the hood.

---

## Screenshots

> _Coming soon._

---

## Quick Start

### Requirements

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- A machine to run it on (a Raspberry Pi 4 works great)

### 1. Clone the repo

```bash
git clone https://github.com/al3ksh/Medium.git
cd Medium
```

### 2. Create the environment file

Copy the example and fill in your own secrets:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env`:

| Variable | What it does | Default |
|---|---|---|
| `JWT_SECRET` | Signs authentication tokens | — (required) |
| `PASSPHRASE` | Password users enter to join (if enabled) | — |
| `PASSPHRASE_ENABLED` | Require a passphrase to join? | `false` |
| `PORT` | Server port (internal) | `3001` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `20971520` (20 MB) |
| `PRIVATE_PASSWORD` | Password for private channels | — |
| `GIPHY_API_KEY` | Giphy API key for the GIF picker | — |

Generate a random JWT secret:

```bash
openssl rand -hex 32
```

### 3. Build and run

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

The app will be available at `http://localhost:8080`.

### 4. (Optional) Expose to the internet

Use a reverse proxy (Cloudflare Tunnel, Nginx, Caddy, etc.) to forward traffic to port 8080. For voice chat, you'll also need a TURN server — see [Voice setup](#voice-setup) below.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  Nginx (80)  │────▶│  Express (3001) │
│             │◀────│              │◀────│  Socket.IO      │
│  React SPA  │     │  Static files│     │  SQLite DB      │
└─────────────┘     │  Proxy /api  │     │  File uploads   │
                    │  Proxy /socket│    └─────────────────┘
                    └──────────────┘
```

- **Client** — React 19 + Vite, served by Nginx with reverse proxy to the backend
- **Server** — Node.js + Express + Socket.IO, SQLite via better-sqlite3
- **Voice** — WebRTC peer-to-peer mesh with optional TURN relay (coturn)
- **Storage** — SQLite database + local filesystem for uploads, both in Docker volumes

### Key technologies

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 6, Lucide icons |
| Backend | Express 4, Socket.IO 4, better-sqlite3 |
| Auth | JWT (24h expiry), optional passphrase gate |
| Voice | WebRTC, coturn TURN server |
| Deployment | Docker Compose, Nginx reverse proxy |

---

## Voice Setup

Voice channels use WebRTC, which works peer-to-peer on the same network. For remote connections (different networks, NAT), you need a TURN server.

### With coturn

1. Install coturn on your server
2. Configure it with a static secret or use the provided helper:

```bash
python3 setup_coturn.py
```

3. Set the environment variables in `server/.env`:

```
TURN_URL=turn:your-domain.com:3478?transport=udp
TURN_SECRET=your-shared-secret
```

4. Open port `3478/tcp` and `3478/udp` on your firewall/router

The server dynamically generates TURN credentials via HMAC and serves them to clients at `/api/ice-servers`.

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Secret for signing JWT tokens | **Required** |
| `PORT` | Server listen port | `3001` |
| `PASSPHRASE_ENABLED` | Show passphrase prompt on join | `false` |
| `PASSPHRASE` | The passphrase users must enter | — |
| `PRIVATE_PASSWORD` | Password to access private channels | — |
| `MAX_FILE_SIZE` | Max upload size in bytes | `20971520` |
| `CLEANUP_INTERVAL` | Message purge interval in ms | `3600000` |
| `UPLOAD_DIR` | Where uploaded files are stored | `./uploads` |
| `GIPHY_API_KEY` | API key for GIF search | — |
| `TURN_URL` | TURN server URL | — |
| `TURN_SECRET` | TURN server shared secret | — |

### Docker Volumes

| Volume | Mount point | Purpose |
|---|---|---|
| `medium-data` | `/app/data` | SQLite database |
| `medium-uploads` | `/app/uploads` | Uploaded files |

---

## Development

### Prerequisites

- Node.js 20+
- npm

### Run in dev mode

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev

# Terminal 2 — frontend
cd client
npm install
npm run dev
```

The Vite dev server proxies API and Socket.IO requests to the backend automatically.

### Build for production

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

---

## Security

- **Auth** — JWT-based with 24h expiry, optional passphrase gate
- **Uploads** — MIME type whitelist (images, video, audio, PDF, text), forced file extensions, `X-Content-Type-Options: nosniff`
- **Headers** — `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: microphone=(self)`
- **Server port** — not exposed externally; only accessible through Nginx reverse proxy
- **Text preview** — content sanitized (control chars stripped), size-limited, React auto-escaping prevents XSS

---

## License

This project is licensed under the [MIT License](LICENSE).
