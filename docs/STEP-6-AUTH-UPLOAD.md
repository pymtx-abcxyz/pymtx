# Step 6 — Auth + Invoice CSV Upload

## Auth

- `User` + `Session` models (ADMIN | BUSINESS)
- Cookie: `harbor_session` (httpOnly, SameSite=Lax)
- `POST /api/auth` login · `GET /api/auth` me · `DELETE /api/auth` logout
- Middleware gates `/admin` and `/business` → `/login`
- Business APIs require session; BUSINESS role scoped to own `businessId`
- Client portal stays public (invite token)

### Demo logins (after seed)

| Role | Email | Password |
|------|-------|----------|
| Business | billing@mapleridgedental.example | harbor-business-demo |
| Admin | admin@harbor.example | harbor-admin-demo |

## Invoice upload

CSV columns (aliases accepted):

```
external_ref,description,amount,due_date,first_name,last_name,email,phone
```

- `amount`: CAD dollars (`850.00`) or integer cents (`85000`)
- Upserts customer by email + invoice by `external_ref`
- Sets status `INVITED`, writes CASL `INVITE` from trade name

### Endpoints

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/businesses/:id/invoices/upload` | multipart `file` or `{ csv }` or `{ invoices: [...] }` |
| `PUT` | `/api/businesses` | `{ businessId, invoices: [...] }` (JSON quick path) |

Business portal: CSV template download + file picker + sample invite.

## Verify

```bash
npx prisma db push
npm run db:seed
npm test
npm run build
```
