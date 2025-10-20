# Q Edu Backend

NestJS + Prisma service that powers authentication, academy operations, Zoom credit management, payments, and platform settings for the Q Edu platform.

---

## 1. Prerequisites

- **Node.js**: v18 or newer (LTS recommended)
- **npm**: v9+ (ships with recent Node versions)
- **MySQL**: v8+ (configured user with privileges to create databases)
- **SMTP Account**: for registration and password reset emails

> ⚠️ The Prisma schema targets MySQL. If you're developing locally, install MySQL and create a database named `qedu`, or update the connection string in `.env`.

---

## 2. Project Setup

### Clone & install
```bash
git clone <repository-url>
cd Q_Edu_backend
npm install
```

### Environment variables
Duplicate `.env.example` (if present) or edit `.env` and make sure the following are set:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/qedu

# JWT configuration
JWT_ACCESS_SECRET=very-strong-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_TTL_SECONDS=604800

# HTTP-only cookie settings for tokens
AUTH_ACCESS_TOKEN_COOKIE_NAME=qedu_access_token
AUTH_REFRESH_TOKEN_COOKIE_NAME=qedu_refresh_token
AUTH_COOKIE_SECURE=false   # true in production (HTTPS)
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_DOMAIN=        # optional (e.g. .example.com)

# SMTP (registration + password reset OTP)
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=true
SMTP_FROM=

# Zoom (optional if Zoom features are used)
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_API_BASE_URL=https://api.zoom.us/v2
ZOOM_OAUTH_URL=https://zoom.us/oauth/token

# Allowed frontend origins (comma separated)
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
```

---

## 3. Database & Prisma workflow

### 3.1 Generate client
```bash
npx prisma generate
```

### 3.2 Apply migrations
```bash
npx prisma migrate dev --name <descriptive-name>
```
This command will:
- create/update the local database schema
- update `prisma/migrations`
- regenerate the Prisma client

> 🔁 If you edit migrations that run before ones already applied, you **must** reset the database so the new order can replay:
> ```bash
> npx prisma migrate reset
> ```
> This drops and recreates the database, so only do it in development.

### 3.3 Inspect schema / data (optional)
```bash
npx prisma studio
```

---

## 4. Running the backend

### Development mode (watch + hot reload)
```bash
npm run start:dev
```
The API will be available at `http://localhost:3000/api` with Swagger UI at `http://localhost:3000/docs` when `NODE_ENV=development`.

### Production build & run
```bash
npm run build
npm run start:prod
```

---

## 5. Code quality & tests

- **ESLint**: `npm run lint`
- **Unit tests**: `npm run test`
- **E2E tests**: `npm run test:e2e`
- **Coverage**: `npm run test:cov`

---

## 6. Troubleshooting

| Issue | Resolution |
| ----- | ---------- |
| `P3006` / migration errors | Run `npx prisma migrate reset` (drops DB) or manually fix the offending SQL in the migration file, then rerun `npx prisma migrate dev`. |
| Unable to verify email OTP | Ensure SMTP credentials are correct and reachable from your dev environment. |
| CORS rejections | Update `CORS_ALLOWED_ORIGINS` or the allowed origins fallback in `src/main.ts`. |
| Cookies not stored in browser | When serving behind HTTPS in production, set `AUTH_COOKIE_SECURE=true` and configure `AUTH_COOKIE_DOMAIN`. |

---

## 7. Related Services

- **Frontend / SaaS app** lives in `../SaaS` and expects this API at `http://localhost:3000/api` by default (`VITE_API_BASE_URL`).

---

Happy hacking! 🎓
