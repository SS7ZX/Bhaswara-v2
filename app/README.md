# Bhaswara v2

Bhaswara is a culture-first language learning platform designed for Indonesia's regional languages. The product combines language learning, AI pronunciation scoring, gamification, and destination style cultural immersion to make local-language education engaging, practical, and identity-driven.

## Why this matters
Indonesia has hundreds of regional languages and many are at risk of decline. Bhaswara responds to that challenge by creating a digital learning environment where young people can practice local language daily while building cultural pride and practical communication skills.

## Core value proposition
- preserve endangered regional languages through daily learning
- make learning fun with XP, streaks, challenges, and leaderboard systems
- use AI to evaluate pronunciation and give meaningful feedback
- connect language learning to local culture, heritage, and community identity

## Stack
- Mobile: React Native + Expo
- API: Express + TypeScript
- AI service: FastAPI + Python
- Shared domain logic: TypeScript workspace package
- Dashboard: Vite + TypeScript

## Architecture overview

- `apps/mobile` contains the learner-facing mobile experience
- `apps/api` handles user, lesson, leaderboard, and scoring APIs
- `apps/dashboard` provides school or teacher-facing monitoring
- `packages/shared` stores domain logic, language metadata, and scoring utilities
- `services/ai` hosts the pronunciation scoring service
- `docs` contains competition and strategy material

## Running the project

### Install dependencies
```bash
cd app
npm install
```

### Configure and run the API
```bash
cd app/apps/api
npm run db:generate
npm run db:migrate:dev
npm run dev
```

The API uses PostgreSQL. Copy `apps/api/.env.example` to `apps/api/.env`, set a unique
`JWT_SECRET` (at least 32 random bytes), and point `DATABASE_URL` at a running PostgreSQL
database before running the commands above. Keep `.env` files out of version control.

For production, build the API and apply committed migrations with `npm run db:migrate`;
do not use `db:migrate:dev` against a production database.

### Run the local container stack

From `app`, copy `.env.example` to `.env`, replace all placeholders, and ensure the
password in `DATABASE_URL` is URL-encoded and matches `POSTGRES_PASSWORD`. Then run:

```powershell
docker compose --env-file .env -f infra\docker\docker-compose.yml up --build
```

The Compose stack binds its service ports to loopback and runs the database migration
before starting the API. It is for local development/demo use, not a highly available
production deployment.

### Run AI service
```bash
cd app/services/ai
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Run mobile app
```bash
cd app/apps/mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` for device builds; production builds require an HTTPS URL.
On iOS and Android, access and refresh tokens are stored in Expo SecureStore. Web builds
keep the session in memory only.

### Run dashboard
```bash
cd app/apps/dashboard
npm install
npm run dev
```

## API endpoints
- `GET /health`
- `GET /ready`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/session` (Bearer token required)
- `POST /auth/logout` (Bearer token required; revokes active access tokens)
- `GET /user/me` (Bearer token required)
- `GET /user/:username` (Bearer token required; own profile only)
- `GET /lessons/:language`
- `GET /culture`
- `GET /leaderboard` (Bearer token required)
- `POST /xp` (Bearer token required; server-verifies lesson answers and awards XP once)
- `POST /score` (Bearer token required; demo-only text scoring, disabled by default)

Accounts are learners by default; clients cannot choose privileged roles or award arbitrary XP.
Access tokens expire after 30 minutes; rotating refresh tokens expire after 30 days. Logout
revokes refresh tokens and invalidates outstanding access tokens for the account.

## AI service endpoints
- `GET /health`
- `GET /languages`
- `POST /score`

## MVP features completed
- Sundanese starter learning flow
- vocabulary cards and quizzes
- demo lesson scoring foundations (real audio/AI pronunciation scoring is not implemented)
- XP, level, and streak mechanics
- leaderboard and ranking
- cultural content exposure

## Competition positioning
This project is designed to stand out in a cultural innovation competition because it is not just an app; it is a cultural preservation and youth engagement platform. The combination of local-language learning, AI, and cultural identity gives it a strong narrative and measurable social impact.

## Demo-ready product story
- preserve endangered regional languages through daily micro-learning and cultural context
- give students AI-based pronunciation feedback to build confidence
- help schools and teachers monitor progress through an institutional dashboard
- create a strong habit loop using XP, streaks, and leaderboard mechanics
- scale from one language to many regional languages through shared infrastructure

## Related documentation
- [docs/BUDAYAGO_COMPETITION_BRIEF.md](./docs/BUDAYAGO_COMPETITION_BRIEF.md)
- [docs/COMPETITION_DEMO_SCRIPT.md](./docs/COMPETITION_DEMO_SCRIPT.md)
- [docs/PRODUCTION_READINESS_CHECKLIST.md](./docs/PRODUCTION_READINESS_CHECKLIST.md)
- [apps/api/README.md](./apps/api/README.md)
