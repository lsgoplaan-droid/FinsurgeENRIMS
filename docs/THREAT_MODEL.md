# FinsurgeENRIMS -- STRIDE Threat Model

**Prepared by**: Security Team
**Date**: 08-Apr-2026
**Version**: 1.0
**Classification**: Confidential -- Security Sensitive

---

## Purpose

This document provides a STRIDE-based threat model for the FinsurgeENRIMS Enterprise Risk Management System. It covers all major attack surfaces: authentication, API layer, data storage, rules engine, network layer, and user access. Each threat is classified by STRIDE category, risk level, and mitigation status.

---

## System Architecture Overview (for threat context)

```
                    Internet
                       |
          [Azure App Gateway + WAF] (planned)
                       |
              [FastAPI Backend :8000]
              /        |         \
     [Auth/JWT]  [API Routes]  [Rules Engine]
              \        |         /
           [SQLAlchemy ORM Layer]
                       |
       [SQLite / Azure PostgreSQL Flexible Server]

     [React Frontend :5173] --- REST API ---> [Backend]
```

**Trust Boundaries:**
1. External network to reverse proxy (Internet boundary)
2. Reverse proxy to FastAPI application (DMZ to application)
3. Application to database (application to data tier)
4. Frontend to backend API (client to server)
5. User roles within the application (privilege boundaries)

---

## STRIDE Category Legend

| Category | Full Name | Description |
|----------|-----------|-------------|
| **S** | Spoofing | Pretending to be something or someone else |
| **T** | Tampering | Modifying data or code without authorization |
| **R** | Repudiation | Claiming to not have performed an action |
| **I** | Information Disclosure | Exposing information to unauthorized parties |
| **D** | Denial of Service | Denying or degrading service to users |
| **E** | Elevation of Privilege | Gaining capabilities without authorization |

**Risk Level Criteria:**

| Level | Likelihood x Impact | Description |
|-------|-------------------|-------------|
| Critical | Very likely, catastrophic impact | Data breach, regulatory penalty, financial loss |
| High | Likely, significant impact | Service disruption, partial data exposure |
| Medium | Possible, moderate impact | Limited data leakage, degraded performance |
| Low | Unlikely, minor impact | Inconvenience, cosmetic issues |

---

## 1. Authentication Layer

| # | Threat | STRIDE | Risk Level | Mitigation | Status |
|---|--------|--------|------------|------------|--------|
| A1 | **Credential stuffing** -- Attacker uses leaked credential databases to attempt login with known username/password pairs | S | Critical | Rate limiting at 5 attempts/min per IP; account lockout after 10 failed attempts; CAPTCHA on repeated failures | Partial -- rate limit config exists but not enforced in middleware |
| A2 | **Brute force password attack** -- Attacker systematically guesses passwords against known usernames | S | High | Rate limiting (5/min); password complexity policy (12 chars, mixed case, digit, special); account lockout | Partial -- password policy configured but lockout not implemented |
| A3 | **Session hijacking via JWT theft** -- Attacker intercepts JWT token from network traffic or XSS | S | Critical | HTTPS-only transmission; HttpOnly + Secure + SameSite cookie flags; short token expiry (30 min); token blacklist on logout | Partial -- 30-min expiry configured; HTTPS and cookie flags not yet enforced |
| A4 | **Token replay attack** -- Attacker reuses a captured JWT token before expiry | S | High | Short-lived access tokens (30 min); refresh token rotation; bind token to IP/user-agent fingerprint; token revocation on suspicious activity | Partial -- short expiry set; IP binding and revocation not implemented |
| A5 | **Missing multi-factor authentication** -- Single-factor auth allows account compromise with stolen password alone | S | Critical | TOTP-based MFA mandatory for admin, compliance_officer, system_administrator roles; recovery codes for backup | Planned -- PyOTP integration not yet implemented |
| A6 | **Password stored in weak hash** -- If password hashing is weak, database breach exposes all credentials | I | High | bcrypt/argon2 with high work factor; salted hashes; never store plaintext | Implemented -- passlib with bcrypt in auth_service.py |
| A7 | **Default/demo credentials in production** -- Demo passwords (Demo@2026) left active in production deployment | S | Critical | Remove seed users in production; force password change on first login; disable demo accounts via environment flag | Partial -- auto-seed removal documented but not enforced |
| A8 | **No login audit trail** -- Failed and successful logins not logged, preventing forensic investigation | R | High | Log all login attempts with timestamp, IP, user-agent, success/failure; alert on anomalous patterns | Partial -- last_login_at updated; no failed attempt logging |

---

## 2. API Layer

| # | Threat | STRIDE | Risk Level | Mitigation | Status |
|---|--------|--------|------------|------------|--------|
| B1 | **SQL injection via search parameters** -- Attacker crafts malicious search strings to manipulate SQL queries | T | Critical | SQLAlchemy ORM parameterized queries; Pydantic input validation; WAF SQL injection rules | Implemented -- ORM prevents raw SQL injection; WAF planned |
| B2 | **Insecure Direct Object Reference (IDOR)** -- Attacker accesses other users' data by changing resource IDs in URLs (e.g., /cases/{other_case_id}) | I | Critical | Verify resource ownership/role authorization on every endpoint; use UUIDs instead of sequential IDs; add row-level access control | Partial -- UUIDs used; no row-level access checks beyond authentication |
| B3 | **Cross-Site Scripting (XSS) via stored input** -- Attacker injects JavaScript in alert notes, case descriptions, or customer names | T | High | Input sanitization (strip HTML/JS); Content-Security-Policy header; React auto-escaping on frontend | Partial -- React escapes by default; no server-side sanitization; no CSP header |
| B4 | **Mass assignment / parameter pollution** -- Attacker sends extra JSON fields to modify protected attributes (e.g., is_admin, risk_score) | T | Medium | Pydantic schemas whitelist allowed fields; reject unknown fields (forbid extra); explicit field mapping in API handlers | Implemented -- Pydantic models control input shape |
| B5 | **API response data leakage** -- Full PAN, Aadhaar, phone numbers returned in list/search endpoints | I | Critical | Mask PII in all list responses: PAN to XXXXX1234X, phone to +91XXXXX3210, Aadhaar to XXXX-XXXX-3456; full data only in detail views with audit log | Partial -- Aadhaar stored as hash; PAN and phone returned in cleartext |
| B6 | **Missing request size limits** -- Attacker sends extremely large payloads to exhaust server memory | D | Medium | Set max request body size (1MB); limit page_size parameter (already capped at 100); Nginx proxy_body_size limit | Partial -- page_size capped in query params; no global body size limit |
| B7 | **No API versioning enforcement** -- Breaking changes could affect integrations | T | Low | API versioned at /api/v1; maintain backward compatibility; deprecation headers for sunset endpoints | Implemented -- /api/v1 prefix in router |
| B8 | **CORS misconfiguration** -- Overly permissive CORS allows malicious sites to make authenticated requests | T | High | Whitelist specific bank domains in CORS_ORIGINS; no wildcard (*); validate Origin header | Implemented -- CORS_ORIGINS from env var, no wildcard in production config |
| B9 | **Missing rate limiting on write endpoints** -- Attacker floods transaction creation or alert manipulation | D | High | Rate limit: 100 req/min general API; 10 req/min for transaction creation; 5 req/min for login; per-IP and per-user limits | Partial -- config exists (RATE_LIMIT_API); middleware not wired |
| B10 | **Lack of request/response logging** -- No audit trail for API calls makes forensics impossible | R | High | Structured JSON logging with correlation ID, user ID, IP, endpoint, method, status code, response time | Planned -- logging framework not yet integrated |

---

## 3. Data at Rest

| # | Threat | STRIDE | Risk Level | Mitigation | Status |
|---|--------|--------|------------|------------|--------|
| C1 | **Database file theft (SQLite)** -- Attacker or insider copies the unencrypted sentinel.db file | I | Critical | Migrate to Azure Database for PostgreSQL with TDE (enabled by default); restrict network access via VNet | Planned -- SQLite in use; Azure PostgreSQL migration documented |
| C2 | **PII exposure in database** -- PAN numbers, phone numbers, email stored in plaintext; Aadhaar as hash only | I | Critical | Field-level encryption (AES-256-GCM) for PAN, phone, email; Aadhaar already hashed; PII_ENCRYPTION_KEY from env | Partial -- encryption key configured; field-level encryption not applied to existing data |
| C3 | **Database backup exposure** -- Unencrypted backups stolen from backup storage | I | High | Encrypt backups with AES-256; store in Azure Blob Storage with access logging and encryption; test restore quarterly | Planned -- no backup system in place |
| C4 | **Audit log tampering** -- Insider modifies or deletes audit trail entries to cover tracks | T | Critical | Append-only audit table; no UPDATE/DELETE grants; separate audit database or immutable ledger; hash chaining for integrity | Planned -- audit model exists but not append-only |
| C5 | **JWT secret key exposure** -- SECRET_KEY leaked from environment or config reveals ability to forge any token | I | Critical | Generate 256-bit key from cryptographic RNG; store in Azure Key Vault; rotate quarterly; never log or commit | Partial -- secrets.token_hex(32) generates strong key; Key Vault integration planned |
| C6 | **PII_ENCRYPTION_KEY in environment** -- Single point of failure; if key is lost, all encrypted PII is irrecoverable | I | High | Store in Azure Key Vault with key versioning; implement key rotation without downtime; maintain sealed backup of keys | Planned |
| C7 | **No data retention enforcement** -- Old transaction/customer data retained indefinitely, increasing breach impact | I | Medium | Auto-archive records older than 7 years; purge after 10 years (PMLA minimum); anonymize for analytics | Planned |
| C8 | **Log files containing PII** -- Application logs may inadvertently contain customer PII | I | Medium | Log scrubbing: mask PAN, Aadhaar, phone in all log output; structured logging with PII-safe serializer | Planned |

---

## 4. Rules Engine

| # | Threat | STRIDE | Risk Level | Mitigation | Status |
|---|--------|--------|------------|------------|--------|
| D1 | **Rule manipulation by unauthorized user** -- Attacker disables critical AML rules to allow illicit transactions to pass undetected | E | Critical | Restrict rule toggle/edit to compliance_officer and system_administrator roles only; maker-checker for rule changes; audit every modification | Partial -- role check via get_current_user; no role-specific restriction on toggle endpoint; no maker-checker |
| D2 | **Denial of service via expensive rule evaluation** -- Attacker submits transactions designed to trigger maximum aggregate computation | D | High | Cache aggregates per time window (already implemented in evaluator); set evaluation timeout (5 seconds max); limit rules evaluated per transaction | Partial -- aggregates_cache per evaluation; no timeout |
| D3 | **Rule bypass via crafted transaction** -- Attacker structures transactions to avoid all rule conditions (e.g., amounts of 999999 paise to avoid >= 1000000 threshold) | T | Medium | Layer rules: single-transaction AND aggregate rules; velocity checks; anomaly detection on deviation from customer baseline | Implemented -- 26 rules with aggregate conditions and time windows |
| D4 | **False negative flood** -- Subtle changes in transaction patterns evade static rules; no machine learning adaptation | T | Medium | Regular rule tuning based on false negative analysis; planned ML model for anomaly detection; back-testing new rules against historical data | Partial -- rules are configurable; ML and back-testing not implemented |
| D5 | **Alert fatigue from false positives** -- Excessive false alerts cause analysts to ignore real threats | D | Medium | Risk scoring with priority classification; deduplication (1-hour window per rule/customer); tunable thresholds; analyst feedback loop | Implemented -- dedup in evaluator; risk scoring; priority-based SLA |
| D6 | **Race condition on concurrent rule evaluation** -- Two simultaneous transactions for same customer produce inconsistent aggregate counts | T | Low | Database-level transaction isolation (SERIALIZABLE for aggregate queries); application-level customer lock for evaluation | Partial -- SQLAlchemy session management; no explicit locking |

---

## 5. Network Layer

| # | Threat | STRIDE | Risk Level | Mitigation | Status |
|---|--------|--------|------------|------------|--------|
| E1 | **Man-in-the-middle (MITM) attack** -- Attacker intercepts HTTP traffic between client and server, capturing JWTs and PII | I | Critical | TLS 1.2+ mandatory; HSTS header with max-age 31536000; certificate pinning for mobile clients; no HTTP fallback | Planned -- HTTPS not configured; HTTP on port 8000 |
| E2 | **Network eavesdropping on database connection** -- Attacker sniffs traffic between application and database server | I | High | TLS for database connections (sslmode=require in PostgreSQL); use private subnet/VPC peering; no public DB endpoint | Planned -- SQLite local file; PostgreSQL TLS not configured |
| E3 | **DNS spoofing / hijacking** -- Attacker redirects users to a fake FinsurgeENRIMS login page | S | High | DNSSEC on domain; certificate transparency monitoring; HSTS preload; user training on URL verification | Planned |
| E4 | **DDoS attack on API endpoints** -- Volumetric or application-layer DDoS overwhelms the service | D | High | Azure WAF + DDoS Protection with rate limiting and bot detection; auto-scaling (Container Apps); circuit breaker patterns | Planned |
| E5 | **Exposed debug/admin endpoints** -- Debug mode or admin panel accessible from public internet | I | Critical | DEBUG=False in production; no /docs or /redoc in production; admin endpoints behind VPN or IP whitelist | Partial -- DEBUG configurable via env; Swagger docs still accessible |
| E6 | **WebSocket hijacking** -- If WebSocket used for real-time alerts, attacker could inject or intercept messages | T | Medium | Authenticate WebSocket connections with JWT; validate origin; use WSS (TLS); message integrity checks | Planned -- WebSocket mentioned in architecture but not fully implemented |
| E7 | **Exposed internal services** -- Database port, Redis port, or monitoring endpoints reachable from internet | I | High | All backend services in private subnet; only reverse proxy (port 443) exposed; security groups/NACLs restrict access | Planned |

---

## 6. User Access and Insider Threats

| # | Threat | STRIDE | Risk Level | Mitigation | Status |
|---|--------|--------|------------|------------|--------|
| F1 | **Privilege escalation via role manipulation** -- User modifies their JWT payload to add admin role | E | Critical | Server-side role validation on every request; JWT signature verification prevents payload tampering; role stored in DB, not solely in token | Implemented -- get_current_user fetches roles from DB on each request |
| F2 | **Insider data exfiltration** -- Authorized user bulk-exports customer PII or transaction data | I | High | Download/export audit logging; anomaly detection on bulk queries; DLP rules for PII in exports; row-level result limits | Partial -- page_size capped at 100; no export functionality; no download logging |
| F3 | **Insider alert suppression** -- Compliance officer closes legitimate STR alerts as false positive to protect a customer | T | Critical | Maker-checker for alert closure on high-risk cases; supervisor review of all STR dispositions; quarterly audit of closed alerts | Partial -- closure requires reason; no maker-checker or supervisor review |
| F4 | **Unauthorized case access** -- Investigator accesses cases not assigned to them | I | Medium | Case visibility based on assignment and role; compliance_officer sees all; investigators see only assigned cases; audit all case views | Partial -- all authenticated users can view all cases |
| F5 | **No segregation of duties** -- Same user creates rules, processes alerts, and files regulatory reports | E | High | Enforce SoD: rule management (compliance_officer only); alert investigation (fraud_investigator, risk_analyst); regulatory filing (compliance_officer); admin functions (system_administrator only) | Partial -- 6 roles defined; endpoint-level role restrictions not fully enforced |
| F6 | **Shared account usage** -- Multiple people sharing a single analyst login, destroying audit trail integrity | R | High | Unique accounts per individual; concurrent session limit (max 3); detect impossible travel (logins from distant IPs in short time) | Partial -- concurrent session config exists; detection not implemented |
| F7 | **Former employee access** -- Terminated employee's account remains active | E | Medium | Immediate account deactivation on termination; automated sync with HR system; periodic access review (quarterly) | Partial -- is_active flag exists; no HR integration or automated review |
| F8 | **Privilege creep** -- User accumulates unnecessary roles over time | E | Low | Quarterly access review; role recertification by manager; alert on role additions; principle of least privilege enforcement | Planned |

---

## Threat Summary Matrix

| Layer | Critical | High | Medium | Low | Total |
|-------|----------|------|--------|-----|-------|
| Authentication (A1-A8) | 3 | 3 | 0 | 0 | 8 |
| API (B1-B10) | 3 | 3 | 2 | 1 | 10 (*) |
| Data at Rest (C1-C8) | 3 | 2 | 2 | 0 | 8 (*) |
| Rules Engine (D1-D6) | 1 | 1 | 3 | 1 | 6 |
| Network (E1-E7) | 2 | 3 | 1 | 0 | 7 (*) |
| User Access (F1-F8) | 2 | 2 | 2 | 1 | 8 (*) |
| **Total** | **14** | **14** | **10** | **3** | **41** |

(*) Some items count as both the listed STRIDE category threat.

---

## Mitigation Status Summary

| Status | Count | Percentage |
|--------|-------|------------|
| Implemented | 10 | 24% |
| Partial | 19 | 46% |
| Planned | 12 | 30% |

---

## Top 10 Priority Remediations

| Priority | Threat ID | Description | Estimated Effort |
|----------|-----------|-------------|-----------------|
| 1 | E1 | TLS/HTTPS enforcement | 1 day (Nginx + cert) |
| 2 | A5 | MFA/TOTP implementation | 2 days |
| 3 | C1 | PostgreSQL migration with encryption | 2 days |
| 4 | B2 | Row-level access control (IDOR fix) | 3 days |
| 5 | A7 | Remove demo credentials in production | 0.5 days |
| 6 | C4 | Immutable audit log | 2 days |
| 7 | D1 | Role-restricted rule management + maker-checker | 2 days |
| 8 | F3 | Maker-checker for high-risk alert closure | 2 days |
| 9 | B5 | PII masking in API responses | 1 day |
| 10 | B10 | Structured request/response logging | 1 day |

**Total estimated effort**: ~16.5 developer-days

---

## Review Schedule

This threat model must be reviewed:
- After any significant architecture change
- After a security incident
- Quarterly as part of the security review cycle
- Before every major release

**Next scheduled review**: 08-Jul-2026

---

*This document is classified as Confidential. Distribution is limited to the development team, CISO, and internal auditors. Do not share externally without CISO approval.*
