# CrisisMesh Full-Stack Deployment

This branch keeps the academic `main` branch unchanged and adapts CrisisMesh for a real two-service deployment.

## Architecture

```text
Browser
  ↓
Vercel — React/Vite frontend
  ↓ HTTPS
Railway — persistent Node bridge
  ↓ persistent stdin/stdout line protocol
C++17 crisismesh_simulation_cli --server
  ↓
SimulationEngine + manual DSA + authoritative state
```

The Node service does not calculate priority, choose responders, route incidents, or reproduce DSA logic. It only exposes the existing C++ command protocol over HTTP and keeps the C++ process alive between requests.

## Backend deployment (Railway)

Deploy this repository from branch `deploy/fullstack`. Railway should use the root `Dockerfile`.

Required runtime variables:

- `RESEND_API_KEY` — server-side Resend API key used for Author recovery OTP; never commit this value
- `AUTHOR_RECOVERY_EMAIL` — registered Author recovery email
- `ALLOWED_ORIGINS` — exact Vercel origin, for example `https://crisismesh.vercel.app`

Recommended:

- `RESEND_FROM_EMAIL` — sender identity. For initial Resend testing, `CrisisMesh 2.0 <onboarding@resend.dev>` can be used subject to Resend's test-recipient restriction. For general delivery, use an address on a verified domain.

Optional local fallback:

- `EMAIL_USER` and `EMAIL_APP_PASSWORD` — Gmail SMTP fallback for local development. Railway Hobby/Trial outbound SMTP is blocked, so hosted OTP uses the Resend HTTPS API.
- `SIMULATION_CLI_PATH` — only needed if the compiled CLI lives somewhere other than the default container path

Railway supplies `PORT` automatically. The service binds to `0.0.0.0` and exposes:

- `GET /health`
- `POST /api/simulation`
- `POST /api/auth/send-author-otp`
- `POST /api/auth/verify-author-otp`

The Docker build compiles only `crisismesh_simulation_cli` and copies that executable into the final Node runtime image.

## Frontend deployment (Vercel)

Import the same repository into Vercel and deploy branch `deploy/fullstack` with the root Vite project.

Set this build-time environment variable before the production deployment:

```text
VITE_API_BASE_URL=https://<railway-service-domain>
```

Do not add a trailing slash. The frontend keeps using local `/api/*` routes when this value is absent, so the existing Vite development bridge continues to work locally.

## Deployment order

1. Deploy the Railway backend.
2. Verify `GET /health`.
3. Copy the Railway public HTTPS domain.
4. Set `VITE_API_BASE_URL` in Vercel.
5. Deploy the Vercel frontend.
6. Update Railway `ALLOWED_ORIGINS` with the final Vercel production origin.
7. Verify STATE, incident report, PROCESS_NEXT, road block/reroute, BFS/DFS/Dijkstra, YES/NO confirmation, and Author OTP.

## State model

The Railway service keeps one persistent C++ `SimulationEngine` process alive while the service instance is running. This preserves incident, responder, dispatch, road, heap/queue, and graph-revision state across normal HTTP requests.

A platform restart or redeploy still resets the current in-memory simulation state. That behavior matches the documented academic limitation. Persistent snapshots can be added later without changing the DSA decision engine.

## Security

- Never commit `.env`, `RESEND_API_KEY`, or Gmail app passwords.
- Only `.env.example` is tracked.
- Restrict `ALLOWED_ORIGINS` to the deployed frontend once the Vercel URL is known.
- The frontend receives no Resend/Gmail credential, OTP secret, password hash, or backend environment value.
- The hosted deployment sends OTP mail through Resend's HTTPS API; the C++ simulation and OTP verification logic remain unchanged.
