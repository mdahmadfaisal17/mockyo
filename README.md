# Mockyo Website

Mockyo is a React/Vite frontend with an Express/MongoDB backend for browsing, managing, and downloading mockups.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB connection string
- Cloudinary credentials
- Optional: Google OAuth, Resend email, GA4, and Cloudflare R2 credentials

## Frontend Setup

```bash
npm install
npm run dev
```

Create `.env` from `.env.example` before running locally.

## Backend Setup

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` from `backend/.env.example` before starting the API.

## Production Build

```bash
npm run build
```

The frontend build output is generated in `dist/`.

## GitHub Notes

- Do not commit `.env`, `backend/.env`, `node_modules/`, `backend/node_modules/`, `dist/`, or log files.
- Commit both `package-lock.json` files so installs are reproducible.
- Configure production environment variables in your hosting provider instead of storing secrets in GitHub.
