# Harbor CRM

Harbor is a CRM for companies, contacts, leads, deals, projects, invoices, documents, and email. It reads the record behind each relationship and keeps sales, delivery, and billing in one place.

## Product

- **Sales** — companies, contacts, leads, opportunities, contracts, products, price lists, and orders
- **Activities** — notes, calls, emails, meetings, and tasks linked to any record
- **Audit history** — field-level change trail, soft delete, and an admin audit log
- **Invoices** — line items, tax, multiple currencies, series, payments, PDF, and email delivery
- **Documents** — file storage on S3-compatible storage
- **Search** — keyword search plus semantic similarity across CRM records
- **Intelligence** — briefings and enrichment from your own records, with confirmation before anything is written
- **Email** — IMAP/SMTP mailbox plus login codes and invoice mail
- **Agent access** — MCP server so an AI client can read and write CRM data with a bearer token

Languages: English, Czech, German, and Ukrainian.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- PostgreSQL 17 with pgvector, Prisma 7
- Better Auth (email code and optional Google sign-in)
- MinIO or any S3-compatible store for files
- Inngest for background jobs
- Optional OpenAI, Anthropic, Firecrawl, and E2B for intelligence features

## Run with Docker

Docker Compose starts Harbor, PostgreSQL, file storage, and background jobs. Migrations run on first start.

```sh
cp .env.docker .env
```

Set `ADMIN_EMAIL` to an address you control, then:

```sh
docker compose up -d
```

Open http://localhost:3000.

Sign-in is a one-time email code. Set `RESEND_API_KEY` and `EMAIL_FROM` so the code is delivered. Without an email provider, read the latest code from the database:

```sh
docker compose exec postgres psql -U nextcrm -d nextcrm \
  -c 'SELECT identifier, value, "expiresAt" FROM verification ORDER BY "createdAt" DESC LIMIT 1;'
```

`value` is the code, then a colon and the attempt count (for example `606331:0`).

| Service | Role | Address |
|---|---|---|
| App | Harbor | `localhost:3000` |
| Postgres | Database | internal |
| MinIO | Files | `127.0.0.1:9000` |
| Inngest | Background jobs | internal |

On a server, set `APP_URL` and `MINIO_PUBLIC_URL` to the public addresses, and replace the default `changeme` passwords for Postgres and MinIO before anyone else can reach the machine.

`BETTER_AUTH_SECRET`, `EMAIL_ENCRYPTION_KEY`, `INNGEST_SIGNING_KEY`, and `INNGEST_EVENT_KEY` are generated on first start and kept in the `app_data` volume. Do not change them later: a new auth secret signs everyone out, and a new encryption key makes stored mailbox passwords and API keys unreadable.

Optional keys in `.env` turn on extra features. An empty key can also be entered later in the admin panel.

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_ID=
GOOGLE_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
FIRECRAWL_API_KEY=
```

```sh
docker compose down        # stop, keep data
docker compose down -v     # stop and delete data
docker compose up -d --build
```

Volumes: `postgres_data`, `minio_data`, `app_data`, `inngest_data`.

## Run from source

Requirements: Node.js 22+, pnpm 10+, PostgreSQL 17 with pgvector.

```sh
pnpm install
cp .env.example .env
cp .env.local.example .env.local
pnpm prisma generate
pnpm prisma migrate deploy
pnpm prisma db seed
pnpm dev
```

`DATABASE_URL` in `.env` must point at that Postgres database. Put auth, storage, and mail settings in `.env.local`. The app listens on http://localhost:3000.

## License

Harbor is licensed under the MIT license. See [LICENSE](LICENSE).
