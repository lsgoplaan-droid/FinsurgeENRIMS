# FinsurgeENRIMS — Production Readiness Implementation Roadmap

**Status**: Phase 1 in progress (55% complete) | **Last Updated**: 2026-04-10

---

## Overview

This document provides a step-by-step roadmap for achieving production readiness. Out of 47 total gaps:
- **11 P0 BLOCKERS**: 6 fixed ✅, 3 in progress ⚠️, 2 pending ❌
- **19 P1 CRITICAL**: Not yet started
- **12 P2 HIGH**: Not yet started
- **5 P3 MEDIUM**: Not yet started

**Key milestones**:
- ✅ **Security foundation** (S1, S2, S3, S5, S11): DONE
- ✅ **API response protection** (D2 PII masking): DONE
- ✅ **Database migration framework**: READY
- ⚠️ **Infrastructure setup** (PostgreSQL, backups, encryption): IN PROGRESS
- ⚠️ **Testing & compliance**: STARTING

**Timeline estimate**: 10-14 weeks (not 8) with 5-person team

---

## Phase 1: Security Hardening (Weeks 1-2) — ACTIVE

### P0 Blockers Status

| ID | Item | Status | Effort | Owner |
|----|------|--------|--------|-------|
| S1 | Hardcoded secret key | ✅ DONE | — | Backend |
| S2 | CORS wildcard | ✅ DONE | — | Backend |
| S3 | No rate limiting | ✅ DONE | — | Backend |
| S5 | No HTTPS enforcement | ✅ DONE | — | Backend |
| S11 | Debug mode enabled | ✅ DONE | — | Backend |
| D1 | No encryption at rest | ⚠️ SETUP READY | 3h | DevOps/Backend |
| D2 | PII in plaintext | ✅ DONE (masking) | — | Backend |
| I1 | SQLite in production | ⚠️ FRAMEWORK READY | 2h | DevOps |
| I3 | No backup/restore | ❌ NOT STARTED | 5h | DevOps |
| I6 | Auto-seed in production | ✅ DONE | — | Backend |
| T1 | Zero test coverage | ⚠️ PARTIAL (57 tests) | 16h | QA |

### Immediately Next (This Week)

1. **Complete I1: PostgreSQL Migration**
   - Task: Test backend with PostgreSQL instead of SQLite
   - Effort: 2 hours
   - Steps:
     ```bash
     # Install PostgreSQL
     # Create database: createdb finsurge_test
     
     # Run backend with PostgreSQL
     export DATABASE_URL=postgresql://user:password@localhost/finsurge_test
     python -m pytest tests/ -v
     
     # Run Alembic migrations
     alembic upgrade head
     ```
   - Success criteria: All 57 tests pass with PostgreSQL
   - Owner: Backend engineer

2. **Complete D1: Field-Level Encryption**
   - Task: Encrypt PAN/Aadhaar in database
   - Effort: 3-4 hours
   - Implementation:
     ```python
     # backend/app/utils/db_encryption.py
     from sqlalchemy import TypeDecorator, String
     from app.utils.encryption import get_encryption
     
     class EncryptedString(TypeDecorator):
         impl = String
         cache_ok = True
         
         def process_bind_param(self, value, dialect):
             if value is None: return None
             return get_encryption().encrypt(value)
         
         def process_result_value(self, value, dialect):
             if value is None: return None
             return get_encryption().decrypt(value)
     
     # backend/app/models/customer.py
     from app.utils.db_encryption import EncryptedString
     
     class Customer(Base):
         pan_number = Column(EncryptedString, nullable=True)
         aadhaar_number = Column(EncryptedString, nullable=True)
     ```
   - Migration:
     ```bash
     alembic revision --autogenerate -m "Add field-level encryption for PAN/Aadhaar"
     alembic upgrade head
     ```
   - Success criteria: Customer data stored encrypted, decrypted on read
   - Owner: Backend engineer

3. **Start I3: Backup Automation**
   - Task: Set up daily PostgreSQL backups with 30-day retention
   - Effort: 5 hours
   - Implementation:
     ```bash
     # backend/scripts/backup.sh
     #!/bin/bash
     BACKUP_DIR="/backups/enrims"
     mkdir -p $BACKUP_DIR
     
     # Daily backup
     pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | \
       gzip > $BACKUP_DIR/enrims_$(date +%Y%m%d_%H%M%S).sql.gz
     
     # Upload to S3
     aws s3 sync $BACKUP_DIR s3://backups-bucket/enrims/
     
     # 30-day retention
     find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
     ```
   - Cron job: `0 2 * * * /path/to/backup.sh` (daily at 2 AM)
   - Test restore: `pg_restore -d finsurge_test backup.sql.gz`
   - Success criteria: Daily backups running, restore tested within 4 hours
   - Owner: DevOps engineer

4. **Expand Test Coverage**
   - Task: Add rules engine tests (52 tests: 26 rules × 2 each)
   - Effort: 12 hours
   - Template:
     ```python
     # backend/tests/test_rules_engine.py
     @pytest.mark.parametrize("rule_id,txn_data,expected_match", [
         # Rule 1: Structure Detection
         ("structure_detection", {"amount": 999999, "source": "suspicious"}, True),
         ("structure_detection", {"amount": 500000, "source": "normal"}, False),
         # Rule 2: Dormant Account Activation
         ("dormant_activation", {"account_dormancy_days": 500, "txn_amount": 10000000}, True),
         ...
     ])
     def test_rule_evaluation(rule_id, txn_data, expected_match):
         alert = evaluate_transaction(db, create_txn(txn_data))
         assert alert is not None if expected_match else alert is None
     ```
   - Success criteria: 80%+ code coverage in rules engine
   - Owner: QA engineer

---

## Phase 2: Testing & Compliance (Weeks 3-4)

**Start after Phase 1 basics (I1, D1, I3) are done.**

### P1 Critical Items (19 items)

High-priority items that unblock UAT:

| Priority | Item | Status | Effort | Links |
|----------|------|--------|--------|-------|
| 1 | T1: Test coverage (80%+) | ⚠️ IN PROGRESS | 16h | Depends on Phase 1 P0s |
| 2 | R1: RBI compliance mapping | ❌ NOT STARTED | 4h | Need RBI Master Direction |
| 3 | R4: Regulatory audit trail | ⚠️ PARTIAL | 3h | Audit model exists, needs wiring |
| 4 | S6: Password policy | ❌ NOT STARTED | 2h | PBKDF2 already used, need validator |
| 5 | S7: Token expiry | ❌ NOT STARTED | 1h | Change ACCESS_TOKEN_EXPIRE_MINUTES |
| 6 | D3: Data masking in APIs | ⚠️ PARTIAL | 2h | Extend to all PII in list endpoints |
| 7 | T3: Rules engine tests | ⚠️ IN PROGRESS | 8h | 52 test cases needed |
| 8 | M1: Logging framework | ⚠️ PARTIAL | 2h | JSON logging exists, structured context needed |
| 9 | I2: Database migrations | ⚠️ READY | 1h | Alembic initialized |
| 10 | C1: CI pipeline | ❌ NOT STARTED | 3h | GitHub Actions workflow |

**Focus areas**:
- Compliance mapping (RBI requirements)
- Complete testing for rules engine
- Wire audit trail to all API handlers
- Set up GitHub Actions CI/CD

---

## Phase 3: Operations & Monitoring (Weeks 5-6)

**Start after Phase 2 testing is passing.**

### P1 Critical Infrastructure (10 items)

| Item | Status | Effort |
|------|--------|--------|
| M2: Application metrics (Prometheus) | ❌ | 3h |
| M3: Alerting (PagerDuty/OpsGenie) | ❌ | 2h |
| S4: MFA/2FA implementation | ❌ | 4h |
| S9: Input sanitization | ❌ | 3h |
| I4: HA/failover setup | ❌ | 8h |
| I7: Reverse proxy (Nginx + WAF) | ❌ | 3h |
| T4: Security testing (SAST/DAST) | ❌ | 4h |
| T6: UAT test scripts | ❌ | 6h |
| C2: CD pipeline | ❌ | 3h |
| V1: Peer review process | ⚠️ PARTIAL | 1h |

**Focus areas**:
- Observability (metrics, logs, alerts)
- Operational resilience (backups, HA, failover)
- Security testing (static + dynamic)
- User acceptance testing

---

## Phase 4: Regulatory & Audit (Weeks 7-8+)

**Final mile before go-live. External audit runs in parallel.**

### P0 & P1 Regulatory Items (5 items)

| Item | Status | Effort | Critical |
|------|--------|--------|----------|
| V2: Third-party security audit | ❌ | EXTERNAL (4-6 weeks) | ✅ P0 BLOCKER |
| R2: CTR auto-filing (FIU-IND) | ❌ | 6h | P1 |
| R3: Suspicious transaction workflow | ❌ | 4h | P1 |
| R5: Data localization proof | ❌ | 2h | P1 |
| D7: Data localization setup | ❌ | 4h | P1 |

**Critical**: Engage CERT-IN security auditor NOW (4-6 week lead time)

---

## Resource Allocation

**Recommended team (5 people)**:

| Role | Count | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|-------|---------|---------|---------|---------|
| Backend Engineer | 2 | 16h | 24h | 12h | 8h |
| DevOps/Infra | 1 | 5h | 4h | 14h | 4h |
| QA Engineer | 1 | 2h | 20h | 10h | 4h |
| Compliance Officer | 1 | 1h | 8h | 2h | 16h |
| Security Auditor | — | — | 4h | 8h | 40h (external) |

**Total effort**: ~164 hours (excluding external audit)

---

## Critical Dependencies

```
Phase 1: Security → Phase 2: Testing → Phase 3: Operations → Phase 4: Audit
  ↓
  I1 PostgreSQL (blocks D1, I3, I4)
  ↓
  D1 Encryption (blocks data protection compliance)
  ↓
  I3 Backups (blocks disaster recovery)
  ↓
  (parallel) Testing, Monitoring, Audit
  ↓
  V2 External Security Audit (4-6 weeks, START NOW)
```

**Critical path items** (if any fail, go-live is blocked):
1. I1: PostgreSQL migration
2. D1: Data encryption at rest
3. I3: Backup & recovery
4. T1: 80%+ test coverage
5. R1/R4: RBI compliance mapping & audit trail
6. V2: External security audit

---

## Success Criteria

### Phase 1 Complete
- [ ] All 11 P0 blockers fixed or verified working
- [ ] Database migrations tested and working with PostgreSQL
- [ ] PII masking in API responses verified
- [ ] Backup automation script created and tested
- [ ] Tests passing on PostgreSQL (57+ tests)

### Phase 2 Complete
- [ ] 80%+ test coverage (80+ tests)
- [ ] RBI compliance mapping document complete
- [ ] Audit trail wired to all API handlers
- [ ] GitHub Actions CI pipeline active
- [ ] 2-approval peer review policy enforced

### Phase 3 Complete
- [ ] Prometheus metrics + Grafana dashboards operational
- [ ] Alerting rules set up in PagerDuty
- [ ] MFA/2FA enabled for all users
- [ ] HA/failover tested
- [ ] Nginx reverse proxy with WAF in place
- [ ] OWASP ZAP + Bandit scans clean

### Phase 4 Complete
- [ ] CTR/SAR auto-filing integrated with FIU-IND
- [ ] PMLA workflow fully implemented
- [ ] Data localization verified (India-only residency)
- [ ] Load testing: 1000 concurrent users, <200ms p95
- [ ] **CERT-IN security audit: PASSED** ✅

---

## Git Workflow

**All work in feature branches with peer review (2 approvals)**:

```bash
# Phase 1 example
git checkout -b phase1/security-hardening
# Make changes
git commit -m "fix: P0 security hardening — HTTPS, CORS, etc"
git push origin phase1/security-hardening

# Create PR, get 2 approvals, merge
gh pr create --base master
# After review: gh pr merge <number>
```

**Commit message format**:
- `fix: P0 gap fix — [gap ID and description]`
- `feat: P1 feature — [description]`
- `test: Add tests for [component]`
- `docs: [documentation]`

---

## Known Issues & Workarounds

1. **Windows file lock on test cleanup**: Test teardown fails on Windows (WAL lock). Harmless, test data is cleaned up.
   - Workaround: Run tests on Linux CI/CD

2. **Python 3.14 wheels missing**: bcrypt incompatible with Python 3.14, using PBKDF2 instead.
   - Status: Not a blocker, PBKDF2 is secure

3. **Pydantic v2 deprecation warnings**: Class-based Config is deprecated.
   - Fix: Migrate to ConfigDict (low priority, code works fine)

---

## Quick Reference: Commands

```bash
# Backend setup
cd backend
source venv/Scripts/activate  # Windows
python main.py                 # Start on :8000

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head           # Apply migrations
alembic downgrade -1           # Rollback

# Testing
pytest tests/ -v              # Run all tests
pytest tests/ --cov=app --cov-report=html  # With coverage

# Docker
docker-compose up --build     # Local development
docker compose -f docker-compose.yml -f docker-compose.azure.yml up  # Azure-like

# Frontend
cd frontend
npm run dev                    # Start on :5173
npm run build                  # Production build
```

---

## Next Action Items

### For Backend Leads
1. [ ] Complete PostgreSQL migration testing (2h)
2. [ ] Implement field-level encryption (3h)
3. [ ] Add password policy validator (2h)
4. [ ] Expand rules engine tests to 80% coverage (12h)

### For DevOps
1. [ ] Set up daily backup automation (5h)
2. [ ] Configure backup testing/restore (2h)
3. [ ] Prepare PostgreSQL deployment (2h)
4. [ ] Set up CI/CD pipeline (3h)

### For QA/Compliance
1. [ ] Create RBI compliance mapping (4h)
2. [ ] Wire audit trail to all API handlers (3h)
3. [ ] Create UAT test scripts (6h)
4. [ ] Initiate CERT-IN auditor engagement (NOW!)

### For Leadership
1. [ ] Engage CERT-IN auditor (4-6 week lead time) — CRITICAL
2. [ ] Budget for external security audit (~$10-20K)
3. [ ] Allocate 5-person team for 10-14 weeks
4. [ ] Schedule weekly production readiness reviews

---

*Last Updated: 2026-04-10 | Next Review: 2026-04-17*
