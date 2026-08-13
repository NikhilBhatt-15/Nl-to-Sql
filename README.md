# NL-to-SQL Assistant

Ask a database a question in plain English. It generates SQL, validates it is
safe to run, executes it against Postgres, and explains the results back to
you in plain English.

## Why this project exists

Built to demonstrate: schema-aware LLM prompting, a real safety/validation
layer around LLM-generated SQL (not just "trust the model"), and a full
production-style stack (FastAPI + Postgres + Next.js) deployed on Vercel/GCP.

## Architecture

```
User logs in (email + password) and types a question in the chat UI (Next.js)
        |
        v
POST /query  --------------------------->  FastAPI backend
        |                                       |
        |                          0. Verify JWT + consume 1 credit
        |                          1. Fetch schema context (cached)
        |                          2. Send question + schema to OpenAI
        |                             -> model returns a SQL query
        |                          3. Validate query (sql_validator.py):
        |                               - must be SELECT only
        |                               - reject DROP/DELETE/UPDATE/ALTER/INSERT
        |                               - run EXPLAIN first to catch errors
        |                               - enforce row limit + timeout
        |                          4. Execute against Postgres
        |                          5. Send results back to OPENAI to
        |                             generate a plain-English summary
        v                                       |
Chat UI renders: generated SQL (collapsible)  <--
                 + results table
                 + plain-English summary
                 + credits remaining
```

## File structure

```text
nl-to-sql-assistant/
├── README.md
├── backend/
│   ├── main.py                    # Entry-point shim (imports app.main:app)
│   ├── database.py                # Multi-db SQLAlchemy manager
│   ├── schema_introspect.py       # Schema metadata fetch + cache
│   ├── sql_generator.py           # NL -> SQL and result explanations
│   ├── sql_validator.py           # SQL safety guardrail layer
│   ├── app/
│   │   ├── main.py                # FastAPI app setup + router mounting
│   │   ├── config.py              # Runtime settings/env config
│   │   ├── schemas.py             # Pydantic API schemas
│   │   ├── security.py            # Password hashing + JWT helpers
│   │   ├── auth_store.py          # Auth user + credits store (Postgres-ready)
│   │   ├── dependencies.py        # Auth dependency injection
│   │   └── routes/
│   │       ├── auth.py            # /auth/register /auth/login /auth/me
│   │       ├── query.py           # /query with credit consumption
│   │       └── schema.py          # /schema endpoints
│   ├── requirements.txt
│   └── .env.example
├── database/
│   └── seed.sql
└── frontend/
    ├── app/
    ├── components/
    │   ├── Navigation.tsx         # Top nav + auth panel + credit display
    │   ├── QueryChat.tsx          # Query chat + results
    │   └── SchemaViewer.tsx       # Schema exploration (tree/diagram)
    └── lib/
        ├── api.ts                 # Backend API client
        └── storage.ts             # Local storage state helpers
```

## Setup

### 1. Database
```bash
createdb nlsql_demo
psql nlsql_demo < database/seed.sql
```

### 2. Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt --break-system-packages
cp .env.example .env
uvicorn main:app --reload
```

Required env vars in `backend/.env`:

- `DATABASE_URL`: default Postgres DB to query
- `OPENAI_API_KEY`: API key for SQL generation and summaries
- `JWT_SECRET_KEY`: secret used to sign auth tokens
- `STARTING_CREDITS`: credits every new user starts with
- `CREDITS_PER_QUERY`: credits consumed for each successful query request
- `AUTH_DATABASE_URL`: Postgres URL for auth/users/credits storage
- `AUTH_DB_PATH`: optional sqlite fallback path when `AUTH_DATABASE_URL` is not set
- `REDIS_URL`: Redis connection URL used for rate limiting and daily caps
- `GOOGLE_CLIENT_ID`: Google OAuth web client ID for `/auth/google`
- `PASSWORD_AUTH_ENABLED`: keep `false` for Google-only authentication

Frontend env (`frontend/.env.local`):

- `NEXT_PUBLIC_API_URL`: backend base URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: same Google OAuth web client ID

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Build order (suggested, matches the plan already scoped)

1. Postgres schema + seed data, FastAPI skeleton, basic `/query` route
2. Schema introspection + Gemini call (SQL generation)
3. `sql_validator.py` -- spend real time here, it's the differentiator
4. Frontend chat UI wired to the backend
5. Polish: loading states, error handling for bad questions, a few example
   prompts on the empty state

## Deploying

- Backend: Google Cloud Run (Dockerfile not included yet -- add one that
  runs `uvicorn main:app --host 0.0.0.0 --port 8080`)
- Frontend: Vercel (works out of the box with `next build`)
- Database: Cloud SQL for Postgres, or any managed Postgres provider

## Auth and credits

- Users must register/login before querying `/query`.
- Google login is available via `POST /auth/google` using Google ID tokens.
- Password register/login endpoints are disabled by default (`PASSWORD_AUTH_ENABLED=false`).
- Credits are consumed per query attempt (`CREDITS_PER_QUERY`).
- If SQL generation or execution fails, consumed credits are refunded automatically.
- Use `/auth/me` to fetch live credit balance for the current user.

## Abuse protection limits

- Per-user and per-IP minute rate limits are enforced with Redis.
- A daily hard query cap per user is enforced with Redis.
- Configure with:
  - `RATE_LIMIT_PER_MINUTE_USER`
  - `RATE_LIMIT_PER_MINUTE_IP`
  - `DAILY_QUERY_LIMIT_PER_USER`
  - `REDIS_STRICT_MODE` (`true` blocks queries if Redis is unavailable)
