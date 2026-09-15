# Step 8 — Redis rate limits, business roles, customer magic link

## Redis rate limits

- `src/lib/rate-limit.ts` uses **ioredis** when `REDIS_URL` is set
- Falls back to in-memory buckets when Redis is unset or unreachable
- Callers must `await rateLimit({ key, limit, windowMs })`
- Applied on: password login, magic-link request/verify, staff invites

```bash
# optional
REDIS_URL="redis://127.0.0.1:6379"
```

## Multi-user business roles

| Role | Connect | Staff invites | Invoice upload / aging |
|------|---------|---------------|------------------------|
| **OWNER** | yes | yes | yes |
| **CLERK** | no | no | yes |
| **ADMIN** | yes (any business) | yes | yes |
| legacy **BUSINESS** | treated as OWNER | | |

- Staff API: `GET/POST /api/businesses/:id/staff` (OWNER/ADMIN)
- Business settings UI includes a Team invite form for owners
- Seeded demos:
  - Owner: `billing@mapleridgedental.example` / `harbor-business-demo`
  - Clerk: `clerk@mapleridgedental.example` / `harbor-clerk-demo`

## Customer magic-link login

1. Customer visits `/login/customer` and submits email
2. `POST /api/auth/magic-link` creates a one-time `MagicLink` (20 min TTL)
3. Demo mode returns `demoUrl`; production would email the link (CASL `MAGIC_LINK` log)
4. `GET /api/auth/magic-link/verify?token=` sets `harbor_session` (customer session) and redirects to `/client?token=<inviteToken>`

Anti-enumeration: unknown emails still return a generic success message.

## Ops

```bash
npx prisma db push
npm run db:seed
npm test
npx tsx scripts/smoke-step8.ts
```
