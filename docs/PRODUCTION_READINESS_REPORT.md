# FinsurgeENRIMS — Production Readiness Report

**Prepared by**: Independent Reviewer
**Date**: 09-Apr-2026
**Version**: 1.0
**Classification**: Confidential

---

## Executive Summary

FinsurgeENRIMS is a functional Enterprise Risk Management prototype covering AML, fraud detection, KYC/CDD, case management, and regulatory reporting. **47 gaps** have been identified across 12 categories that must be addressed before production deployment in a banking environment.

**Verdict**: NOT PRODUCTION READY
**Estimated remediation**: 3 weeks with a 7-person team working in parallel streams

---

## Severity Legend

| Level | Meaning | Count |
|-------|---------|-------|
| **P0 — BLOCKER** | Must fix before any deployment. Regulatory/security risk. | 16 |
| **P1 — CRITICAL** | Must fix before bank UAT. Operational risk. | 19 |
| **P2 — HIGH** | Must fix before go-live. Quality/reliability risk. | 12 |

---

## 1. Security Gaps (11)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| S1 | Hardcoded secret key | P0 | `SECRET_KEY = "finsurge-enrims-..."` in config.py | Environment variable, rotated quarterly, min 256-bit |
| S2 | CORS wildcard `*` | P0 | `allow_origins=["*"]` in main.py | Whitelist specific bank domains only |
| S3 | No rate limiting | P0 | Login/API endpoints unlimited | 5 login attempts/min, 100 API req/min per user |
| S4 | No MFA/2FA | P0 | Single-factor password only | TOTP/SMS OTP, mandatory for admin & compliance roles |
| S5 | No HTTPS enforcement | P0 | HTTP on port 8000 | TLS 1.2+ mandatory, HSTS headers |
| S6 | Weak password policy | P1 | No complexity enforcement | Min 12 chars, mixed case + digit + special, 90-day rotation |
| S7 | Token expiry too long | P1 | 480 minutes (8 hours) | 30 min with sliding refresh, re-auth for sensitive ops |
| S8 | No session management | P1 | Stateless JWT, no revocation | Token blacklist on logout, concurrent session control |
| S9 | No input sanitization | P1 | Basic Pydantic only | XSS prevention, 1MB request limit, header validation |
| S10 | No API key management | P2 | No external API auth | API keys for integrations, OAuth2 for third-party |
| S11 | Debug mode enabled | P0 | `DEBUG = True` default | False in production, no stack traces in responses |

## 2. Data Protection & Privacy (8)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| D1 | No encryption at rest | P0 | SQLite unencrypted | Azure PostgreSQL with TDE (enabled by default) |
| D2 | PII in plaintext | P0 | PAN, Aadhaar, phone stored in clear | Field-level encryption (AES-256-GCM) for PAN, Aadhaar hash |
| D3 | No API data masking | P1 | Full PAN/phone in list responses | Mask: PAN → XXXXX1234X, Phone → +91XXXXX3210 |
| D4 | No retention policy | P1 | Data kept forever | Auto-archive 7 years, purge 10 years (RBI mandate) |
| D5 | No data classification | P2 | No field labels | Classify: Public, Internal, Confidential, Restricted |
| D6 | No consent management | P2 | No customer consent tracking | DPDP Act 2023 compliance |
| D7 | No data localization | P1 | Can deploy anywhere | India-only data residency (RBI circular 2018) |
| D8 | Audit log not wired | P1 | Model exists, unused | Log every read/write: user, IP, timestamp, resource, action |

## 3. Database & Infrastructure (7)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| I1 | SQLite in production | P0 | Single-file database | Azure Database for PostgreSQL Flexible Server with PgBouncer |
| I2 | No migrations | P1 | `create_all()` on startup | Alembic versioned migrations |
| I3 | No backup/restore | P0 | No backups | Daily automated backups, point-in-time recovery |
| I4 | No HA/failover | P1 | Single instance | Primary-replica with automatic failover |
| I5 | No containerization | P2 | Direct Python execution | Docker + Azure Container Apps / AKS orchestration |
| I6 | Auto-seed in prod | P0 | `seed_all()` on empty DB | Remove; use migrations for reference data only |
| I7 | No reverse proxy | P1 | Direct uvicorn | Nginx + WAF + DDoS protection |

## 4. Testing (6)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| T1 | Zero test coverage | P0 | No tests | Min 80% coverage: unit + integration + API tests |
| T2 | No test infrastructure | P1 | No pytest config | pytest + httpx + factory_boy |
| T3 | Rules engine untested | P0 | 26 rules, 0 tests | 52+ test cases (positive + negative per rule) |
| T4 | No security testing | P1 | No SAST/DAST | OWASP ZAP + Bandit + dependency vulnerability scan |
| T5 | No load testing | P2 | No baseline | 1000 concurrent users, p95 < 200ms |
| T6 | No UAT scripts | P1 | No documented scenarios | Step-by-step scripts per module |

## 5. Monitoring & Observability (5)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| M1 | No logging | P0 | Zero log output | Structured JSON logging (structlog), correlation IDs |
| M2 | No metrics | P1 | Nothing measured | Prometheus: request rate, errors, latency |
| M3 | No alerting | P1 | No alerts | PagerDuty/OpsGenie on error spike, DB down |
| M4 | No APM/tracing | P2 | No visibility | OpenTelemetry distributed tracing |
| M5 | Weak health check | P2 | Static `{"status":"healthy"}` | Check DB, disk, memory, queue depth |

## 6. Regulatory Compliance — RBI/PMLA (5)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| R1 | No RBI compliance map | P0 | No documentation | Feature-to-regulation mapping document |
| R2 | CTR filing incomplete | P1 | Model exists, no actual filing | FIU-IND portal integration |
| R3 | No PMLA workflow | P1 | Basic alert→case | Full Section 12: detection → principal officer → FIU |
| R4 | No regulatory audit trail | P0 | Audit model unused | Immutable, append-only, tamper-proof, 5-year retention |
| R5 | No data localization proof | P1 | No docs | Deployment certificate: India-only residency |

## 7. CI/CD & DevOps (3)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| C1 | No CI pipeline | P1 | No GitHub Actions | Lint + test + security scan on every PR |
| C2 | No CD pipeline | P2 | Manual deploy | Staging → production with approval gates |
| C3 | No infra-as-code | P2 | Manual setup | Terraform/Pulumi |

## 8. Independent Review (2)

| # | Gap | Severity | Current State | Required State |
|---|-----|----------|---------------|----------------|
| V1 | No peer review process | P1 | Single developer | 2 approvals per PR (1 dev + 1 security) |
| V2 | No third-party audit | P0 | No external audit | CERT-IN empanelled auditor certification |

---

## 3-Week Remediation Roadmap

### Team Structure (7 people)

| Role | Count | Focus |
|------|-------|-------|
| Backend Developer | 2 | Security hardening, PII encryption, auth, API fixes |
| DevOps/SRE Engineer | 2 | PostgreSQL, Docker, CI/CD, monitoring, Nginx |
| QA Engineer | 1 | Test suite, UAT scripts, security testing |
| Compliance Officer | 1 | RBI mapping, PMLA workflow, audit trail design |
| External Auditor | 1 | CERT-IN audit (starts Week 2, delivers Week 3) |

### Week 1: Security + Infrastructure (All P0 blockers)

**Stream A — Backend Security** (2 backend devs)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon | Environment-based config, remove hardcoded secrets | S1, S11 |
| Mon | CORS whitelist, HTTPS enforcement headers | S2, S5 |
| Tue | Rate limiting middleware (slowapi) | S3 |
| Tue | Password policy enforcement + token expiry fix | S6, S7 |
| Wed | Session management: token blacklist, concurrent control | S8 |
| Wed | Input validation + sanitization middleware | S9 |
| Thu | PII field-level encryption (AES-256-GCM) for PAN, Aadhaar | D2 |
| Thu | API response data masking for list endpoints | D3 |
| Fri | Remove auto-seed, structured logging framework | I6, M1 |

**Stream B — Infrastructure** (2 DevOps)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon | Azure PostgreSQL Flexible Server setup + migrate database.py | I1, D1 |
| Tue | Alembic migration framework + initial migration | I2 |
| Wed | Docker: backend Dockerfile + frontend Dockerfile | I5 |
| Thu | docker-compose.yml + Nginx reverse proxy + WAF | I7 |
| Fri | Automated backup/restore + CI pipeline (GitHub Actions) | I3, C1 |

**Stream C — Compliance** (Compliance officer)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon-Wed | RBI compliance mapping document | R1 |
| Thu-Fri | Audit trail schema design + immutability requirements | R4 |

### Week 2: Testing + Compliance + Monitoring

**Stream A — Testing** (2 backend devs + QA)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon | pytest infrastructure, conftest, factories | T2 |
| Mon-Tue | Auth + API endpoint tests (50+ tests) | T1 |
| Wed-Thu | Rules engine test suite (52 test cases, all 26 rules) | T3 |
| Fri | Security testing: Bandit SAST + OWASP ZAP | T4 |

**Stream B — Operations** (2 DevOps)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon | Prometheus metrics middleware | M2 |
| Tue | Grafana dashboards + alerting rules | M3 |
| Wed | Enhanced health check (DB, memory, disk) | M5 |
| Thu | HA: Azure PostgreSQL zone-redundant HA + failover | I4 |
| Fri | OpenTelemetry tracing | M4 |

**Stream C — Compliance** (Compliance officer + 1 dev)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon-Tue | Audit trail middleware, wire to all API handlers | D8 |
| Wed | PMLA Section 12 workflow implementation | R3 |
| Thu | Data retention policy + auto-archive | D4 |
| Fri | UAT test scripts for all modules | T6 |

**External Auditor starts review** (end of Week 2)

### Week 3: Regulatory + MFA + Load Test + Audit

**Stream A — Remaining Features** (2 backend devs)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon | MFA/TOTP implementation | S4 |
| Tue | API key management for integration endpoints | S10 |
| Wed | FIU-IND CTR/STR filing integration | R2 |
| Thu | DPDP Act consent management | D6 |
| Fri | Data classification labels + bug fixes | D5 |

**Stream B — Final Ops** (2 DevOps)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon | CD pipeline: staging → production with gates | C2 |
| Tue | Infrastructure-as-code (Terraform + azurerm) | C3 |
| Wed | Load testing: 1000 concurrent users | T5 |
| Thu | Data localization proof + deployment certificate | D7, R5 |
| Fri | DR test: backup restore in < 4 hours | I3 verify |

**Stream C — Audit & Review** (Compliance + External Auditor)
| Day | Deliverable | Items |
|-----|-------------|-------|
| Mon-Wed | CERT-IN auditor: penetration test + code review | V2 |
| Thu | PR review policy enforcement | V1 |
| Fri | **Final audit report + sign-off** | V2 |

---

## Verification Checklist (Day 15)

| # | Check | Pass Criteria |
|---|-------|---------------|
| 1 | Test suite | `pytest --cov=app` → 80%+ coverage, 0 failures |
| 2 | SAST scan | Bandit → 0 high-severity findings |
| 3 | DAST scan | OWASP ZAP → 0 critical/high findings |
| 4 | Load test | 1000 users, p95 < 200ms, 0 errors |
| 5 | RBI compliance | All items in mapping document checked |
| 6 | CERT-IN audit | Certification obtained |
| 7 | DR test | Restore from backup in < 4 hours |
| 8 | MFA working | All admin/compliance users on TOTP |
| 9 | Audit trail | Every API action logged, immutable |
| 10 | PII encrypted | PAN/Aadhaar encrypted at rest, masked in API |
| 11 | No secrets in code | `git log` clean, no hardcoded credentials |
| 12 | Monitoring live | Grafana dashboards showing metrics, alerts configured |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CERT-IN audit delays | Medium | High | Engage auditor Day 1, provide codebase access early |
| Azure PostgreSQL migration data issues | Low | High | Test migration on staging with full dataset first |
| Load test failures | Medium | Medium | Profile and optimize top 5 slow endpoints in Week 2 |
| FIU-IND API access delays | High | Medium | Build mock interface, swap real API when credentials arrive |
| Team availability | Medium | High | Cross-train: each stream has a backup person |

---

## Cost Estimate

| Item | 3-Week Cost (INR) |
|------|-------------------|
| 2 Backend Developers | 6,00,000 |
| 2 DevOps Engineers | 6,00,000 |
| 1 QA Engineer | 2,50,000 |
| 1 Compliance Officer | 3,00,000 |
| CERT-IN Auditor | 5,00,000 |
| Azure PostgreSQL Flexible Server | 15,000/mo |
| Monitoring (Grafana Cloud) | 10,000/mo |
| Infrastructure (Azure Central India) | 50,000/mo |
| **Total** | **~23,25,000** |

---

## Appendix: Files Requiring Changes

### New Files
```
.github/workflows/ci.yml
backend/Dockerfile
frontend/Dockerfile
docker-compose.yml
backend/alembic/
backend/alembic.ini
backend/tests/conftest.py
backend/tests/test_auth.py
backend/tests/test_rules_engine.py
backend/tests/test_alerts.py
backend/tests/test_transactions.py
backend/tests/test_cases.py
backend/app/middleware/audit.py
backend/app/middleware/rate_limit.py
backend/app/utils/encryption.py
backend/app/utils/masking.py
docs/rbi-compliance-mapping.md
docs/deployment-runbook.md
docs/threat-model.md
docs/uat-test-scripts.md
```

### Modified Files
```
backend/app/config.py          → Env-based config, remove defaults
backend/main.py                → CORS whitelist, remove auto-seed, add middleware
backend/app/database.py        → PostgreSQL + connection pooling
backend/app/services/auth_service.py → MFA, token rotation, password policy
backend/app/dependencies.py    → Enhanced auth checks, rate limit decorator
backend/app/api/*.py           → Audit logging, input validation, data masking
backend/app/models/customer.py → Encrypted PII fields
backend/requirements.txt       → Add slowapi, structlog, prometheus-client, pyotp, alembic
```

---

*Report prepared for FinsurgeENRIMS production deployment assessment.*
*This document should be reviewed by the bank's CISO and Chief Compliance Officer before implementation begins.*
