# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FinsurgeENRIMS — Enterprise Risk Management System for banking (AML, fraud detection, KYC, case management, regulatory reporting). Python 3.12 backend, React 18 frontend, SQLite for demo.

## Commands

### Backend
```bash
cd backend
source venv/Scripts/activate   # Windows
# source venv/bin/activate     # macOS/Linux
python main.py                 # Starts on :8000, auto-seeds DB if empty
```

### Frontend
```bash
cd frontend
npm install
npm run dev                    # Starts on :5173, proxies /api to :8000
npm run build                  # Production build to dist/
```

### Tests
```bash
cd backend
source venv/Scripts/activate
pytest tests/ -v                              # All tests
pytest tests/test_rules_engine.py -v          # Rules engine only
pytest tests/test_auth.py::test_login_success # Single test
pytest tests/ --cov=app --cov-report=term     # With coverage
```

### Docker
```bash
docker-compose up --build      # Backend :8000 + Frontend :3000
```

## Architecture

### Backend (FastAPI)

**Request flow**: Client → CORS → RateLimitMiddleware → AuditMiddleware → Router → `get_current_user` dependency (JWT) → API handler → Service/Engine → SQLAlchemy Model → SQLite/PostgreSQL

**Key architectural decisions**:
- `main.py` lifespan auto-creates tables and seeds demo data when DB is empty
- `app/api/router.py` aggregates 16 module routers under `/api/v1`
- Auth uses PBKDF2 hashing (not bcrypt — passlib has compatibility issues on Python 3.12+)
- `SECRET_KEY` auto-generates via `secrets.token_hex(32)` if not set in env — fine for demo, must pin for production
- SQLite with WAL mode and FK enforcement via PRAGMA on connect

**Rules engine** (`app/engine/evaluator.py`):
- `evaluate_transaction(db, txn)` is the main entry point, called from `POST /api/v1/transactions`
- Loads all enabled Rules, builds transaction context (customer + account + aggregates over time windows)
- Evaluates JSON condition trees with AND/OR nesting and 10 operators
- On match: creates Alert (with dedup check), flags transaction, adjusts customer risk score
- Auto-assigns new alerts to analysts via `services/alert_assignment.py`

**Maker-checker** (`app/services/maker_checker.py`):
- `PendingAction` model (defined in this service file, not in models/) — registered via `models/__init__.py`
- 7 controlled action types: rule_change, case_closure, report_filing, user_role_change, alert_bulk_close, watchlist_modification, config_change

**Middleware stack** (order in main.py matters — last added = first executed):
1. AuditMiddleware — logs every request to `audit_log` table
2. RateLimitMiddleware — in-memory per-IP tracking, skipped when `TESTING=true`
3. CORSMiddleware

### Frontend (React + TypeScript + Vite)

**Routing**: `App.tsx` checks `localStorage.getItem('token')` → renders LoginPage or DashboardLayout with nested routes (16 pages).

**API calls**: All go through `src/config/api.ts` (Axios instance). Uses `VITE_API_URL` env var, defaults to `/api/v1` (Vite proxies to backend in dev).

**Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin. No tailwind.config.js — v4 auto-detects. Custom theme vars in `index.css`.

### Database

- Models in `app/models/` — 13 files, all imported via `app/models/__init__.py`
- `_register_all_models()` is called by `database.create_tables()` to ensure all models are loaded before `metadata.create_all()`
- `Case.sar_id` has no FK constraint (circular reference avoided) — just a string column
- Monetary amounts stored as INTEGER in paise (1 INR = 100 paise)

### Seed Data

`app/seed/seed_all.py` creates: 8 users (password: `Demo@2026`), 49 customers with Indian banking personas, 80 accounts, ~4000 transactions, 26 detection rules, 150 alerts, 25 cases, 200 watchlist entries, KYC reviews, network relationships, CTR/SAR reports.

Key demo personas: CIF-1001 Rajesh Mehta (structuring), CIF-1003 Hassan Trading (layering), CIF-1010 Ananya Sharma (card fraud), CIF-1015 K. Dhanabalan (PEP).

## Environment Variables

| Variable | Required in prod | Default |
|----------|-----------------|---------|
| `SECRET_KEY` | Yes | Auto-generated (changes on restart) |
| `PII_ENCRYPTION_KEY` | Yes | Auto-generated |
| `DATABASE_URL` | Yes | `sqlite:///./sentinel.db` |
| `CORS_ORIGINS` | Yes | `http://localhost:5173,http://localhost:3000` |
| `DEBUG` | No | `false` |
| `VITE_API_URL` | Frontend only | `/api/v1` |

## Python Version

Must use **Python 3.12** (see `backend/.python-version`). Python 3.14 breaks pydantic-core (no pre-built wheels, needs Rust compiler).

## Gotchas

- `conftest.py` sets `TESTING=true` env var to disable rate limiter during tests
- The `health` endpoint does a raw SQL `SELECT 1` — works on both SQLite and PostgreSQL
- Frontend `package.json` was manually created (not from Vite template) — needs `"type": "module"` and explicit scripts
- Tailwind v4 has no config file — uses CSS `@theme` directive in `index.css`
- `PendingAction` model lives in `services/maker_checker.py`, not in `models/` — imported via `models/__init__.py`
