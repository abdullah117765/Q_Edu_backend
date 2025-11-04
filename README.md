# Q Edu Backend

NestJS + Prisma service that powers authentication, academy management, class scheduling (with Zoom integration), resource delivery, and platform metrics for the Q Edu ecosystem.

---

## 1. Prerequisites

- **Node.js** v18+ (LTS recommended)
- **npm** v9+
- **MySQL** v8+ (or compatible MariaDB)
- **SMTP account** (for registration + password reset emails)

---

## 2. Quick Start

```bash
git clone <repository-url>
cd Q_Edu_backend
npm install
cp .env.example .env    # or create .env manually
```

Fill in `.env` (see sample below), then run:

```bash
npx prisma migrate dev
npm run start:dev
```

The API will be available at `http://localhost:3000/api` with Swagger UI at `http://localhost:3000/docs` (when `NODE_ENV=development`).

---

## 3. Environment Variables

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/qedu

# JWT
JWT_ACCESS_SECRET=very-strong-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_TTL_SECONDS=604800

# Token cookies
AUTH_ACCESS_TOKEN_COOKIE_NAME=qedu_access_token
AUTH_REFRESH_TOKEN_COOKIE_NAME=qedu_refresh_token
AUTH_COOKIE_SECURE=false      # true in production
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_DOMAIN=

# SMTP
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=true
SMTP_FROM=

# Zoom (optional but required for real meetings)
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_ENABLED=true
ZOOM_API_BASE_URL=https://api.zoom.us/v2
ZOOM_OAUTH_URL=https://zoom.us/oauth/token

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001

# File storage
FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=./storage/uploads
FILE_STORAGE_PUBLIC_ROOT=/storage
FILE_STORAGE_PUBLIC_URL=http://localhost:3000/storage
```

> The Zoom service automatically normalises any OAuth URL that does not end in `/oauth/token`.

---

## 4. Prisma Workflow

| Action | Command | Notes |
| ------ | ------- | ----- |
| Generate client | `npx prisma generate` | Regenerates Prisma client after schema changes. |
| Apply migrations | `npx prisma migrate dev` | Applies migrations locally and updates client. |
| Reset database | `npx prisma migrate reset` | Drops + recreates database (development only). |
| Inspect data | `npx prisma studio` | Launches Prisma Studio. |

The migration `20251103100000_expand_zoom_urls` expands `zoomJoinUrl` and `zoomStartUrl` to 512 characters—run the latest migrations whenever pulling new changes.

---

## 5. Running & Building

| Mode | Command | Description |
| ---- | ------- | ----------- |
| Development | `npm run start:dev` | Watch mode with live reload. |
| Production build | `npm run build` | Compiles TypeScript to JavaScript. |
| Production run | `npm run start:prod` | Runs compiled output. |

---

## 6. Quality & Tests

| Task | Command |
| ---- | ------- |
| Lint | `npm run lint` |
| Unit tests | `npm run test` |
| E2E tests | `npm run test:e2e` |
| Coverage | `npm run test:cov` |

---

## 7. Documentation

- **Platform overview:** `docs/platform-feature-guide.md`
- **Module deep dives:** `docs/module-guides/` (`auth.md`, `users.md`, `academies.md`, `classes.md`, `dashboard.md`, `resources.md`, `zoom.md`, `zoom-credits.md`)
- Convert any Markdown doc to Word with `pandoc docs/<file>.md -o <file>.docx`

The companion frontend project lives in `../SaaS`. Update its `.env` (`VITE_API_BASE_URL`, `VITE_ASSET_BASE_URL`) to match your backend host.

---

## 8. Troubleshooting

| Issue | Resolution |
| ----- | ---------- |
| Login succeeds but dashboards empty | Ensure academy onboarding/membership approvals are complete. |
| Placeholder Zoom links | Check `ZOOM_*` credentials; see WARN logs from `ZoomService`. |
| `P2000` or “value too long” on class creation | Run latest migrations to expand Zoom URL columns. |
| Cookies missing in browser | For HTTPS deployments, set `AUTH_COOKIE_SECURE=true` and configure `AUTH_COOKIE_DOMAIN`. |
| CORS error | Add frontend origin to `CORS_ALLOWED_ORIGINS` or adjust defaults in `main.ts`. |

---

Happy building! For feature-level documentation, consult the module guides linked above. 
