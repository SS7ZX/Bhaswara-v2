# Production Readiness Checklist

## Product and UX
- [x] account registration, login, and session restoration in the learner app
- [x] progress tracking for quiz completion and XP in the initial lesson catalog
- [ ] teacher / school dashboard for cohort analytics
- [ ] consent and privacy notice for voice collection
- [ ] accessibility reviews for mobile readability and contrast

## Data and reliability
- [x] PostgreSQL schema, generated client, migration, and bounded connection pool
- [ ] Redis cache for leaderboard and hot reads
- [ ] retry strategy for external AI calls
- [x] request IDs, structured error logs, liveness, and readiness endpoints
- [ ] centralized logs, metrics, tracing, and alerting
- [ ] backups and retention policy for user audio
- [ ] tested backup restore and disaster-recovery objectives

## Security
- [x] username/password registration and login with short-lived JWT access tokens
- [x] token-version revocation on logout and database-backed role checks
- [x] password hashing with bcrypt
- [x] request validation, security headers, CORS allow-list, and API/auth rate limits
- [ ] distributed rate-limit storage and proxy/IP configuration for multi-instance deployment
- [x] rotating refresh tokens, hashed at rest, with token-family replay revocation
- [ ] email verification, password reset, and account recovery
- [ ] authorization tests for every privileged role and object boundary
- [ ] compliance review for personal data and child protection
- [ ] consent collection, account deletion/export, and retention enforcement
- [ ] HTTPS termination, secret manager integration, and security incident procedures

## AI and voice
- [ ] language-specific datasets for targeted dialect support
- [ ] model versioning and evaluation thresholds
- [ ] audio storage and consent management
- [ ] failure fallback when AI service is unavailable
- [ ] replace the disabled-by-default demo text comparison with real speech inference

## Business and growth
- [ ] school partnership pipeline
- [ ] B2G / B2B pilot arrangement
- [ ] campaign KPIs and retention tracking
- [ ] content creation workflow with local cultural experts
