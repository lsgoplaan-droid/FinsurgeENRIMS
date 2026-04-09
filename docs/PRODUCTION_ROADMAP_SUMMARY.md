# FinsurgeENRIMS — Production Roadmap (54 Items)

## Item Counts

| Type | P0 | P1 | P2 | P3 | Done | Total |
|------|----|----|----|----|------|-------|
| Wow Features (27) | 0 | 13 | 9 | 2 | 3 | 27 |
| Production Gaps (27) | 8 | 8 | 7 | 0 | 0 | 23* |
| **Total** | **8** | **21** | **16** | **2** | **3** | **50** |

*4 gaps already partially addressed (masking/encryption built but not wired)

---

## Sprint Plan (5 Sprints across 5 weeks)

### Sprint 1 — Week 1: Security Foundations + CRO Wow (14 items)
| ID | Item | Type | Effort |
|----|------|------|--------|
| PG-I01 | CORS → Whitelist | Gap P0 | 0.5d |
| PG-I11 | Remove auto-seed in prod | Gap P0 | 0.5d |
| PG-I08 | HTTPS / TLS enforcement | Gap P0 | 1d |
| PG-F01 | MFA / 2FA (TOTP) | Gap P0 | 3d |
| PG-F02 | Token revocation / logout | Gap P0 | 1d |
| PG-F03 | Wire PII encryption to DB fields | Gap P0 | 2d |
| PG-I02 | SQLite → Azure PostgreSQL | Gap P0 | 2d |
| PG-I03 | Alembic migrations | Gap P0 | 2d |
| PG-F04 | Wire API data masking | Gap P1 | 1d |
| PG-F12 | React Error Boundaries | Gap P1 | 1d |
| PG-I10 | Bandit CI blocking | Gap P1 | 0.5d |
| W-CRO-01 | Risk Heatmap (India map) | Wow P1 | 3d |
| W-CRO-02 | Risk Appetite Dashboard | Wow P1 | 2d |
| W-CRO-03 | Board Report PDF Generator | Wow P1 | 2d |
| W-CRO-06 | Executive Drilldown (complete) | Wow P1 | 1d |
| W-CO-01 | RBI Compliance Scorecard | Wow P1 | 1d |

**Sprint 1 Total: ~23 days of work → 2 devs × 5 days = 10 dev-days + buffer**

---

### Sprint 2 — Week 2: Detection Power + Audit Trail (13 items)
| ID | Item | Type | Effort |
|----|------|------|--------|
| PG-I05 | Backup / restore automation | Gap P0 | 2d |
| PG-I04 | Redis-backed rate limiter | Gap P1 | 1d |
| PG-I09 | Input sanitization (XSS) | Gap P1 | 2d |
| W-CO-03 | Filing Deadline Tracker | Wow P1 | 2d |
| W-CO-04 | Audit Trail Export (hash chain) | Wow P1 | 2d |
| W-RM-01 | Alert Tuning Dashboard | Wow P1 | 2d |
| W-RM-02 | Investigation Copilot (full) | Wow P1 | 2d |
| W-RM-03 | Mule Network Force-Graph | Wow P1 | 3d |
| W-RM-04 | SLA Burndown Chart | Wow P1 | 2d |
| W-AUD-01 | Immutable Audit Log (hash chain) | Wow P1 | 2d |

**Sprint 2 Total: ~20 days → 2 devs × 5 days + 1 frontend dev**

---

### Sprint 3 — Week 3: Infrastructure + Analytics (10 items)
| ID | Item | Type | Effort |
|----|------|------|--------|
| PG-I06 | HA / failover setup | Gap P1 | 3d |
| PG-I07 | Reverse proxy / WAF | Gap P1 | 2d |
| PG-I13 | Monitoring / APM (Prometheus) | Gap P1 | 3d |
| PG-F05 | Data retention / purge policy | Gap P1 | 2d |
| W-CRO-04 | What-If Scenario Simulator | Wow P2 | 3d |
| W-CO-06 | PEP/Sanctions Auto-Screening | Wow P2 | 3d |
| W-RM-05 | Rule Backtesting Engine | Wow P2 | 3d |
| W-RM-06 | Duplicate / Link Detection | Wow P2 | 3d |
| W-IT-01 | API Health Dashboard | Wow P2 | 2d |
| W-AUD-02 | User Activity Analytics | Wow P2 | 2d |

**Sprint 3 Total: ~26 days → 3 devs × 5 days**

---

### Sprint 4 — Week 4: Integrations + Operations (9 items)
| ID | Item | Type | Effort |
|----|------|------|--------|
| PG-F07 | External system integrations (real stubs) | Gap P1 | 5d |
| PG-F10 | FIU-IND CTR/STR filing connector | Gap P1 | 4d |
| PG-F08 | Internal fraud module (real DB) | Gap P2 | 3d |
| PG-F09 | Fraud scenarios (real DB) | Gap P2 | 2d |
| PG-I14 | Load testing (Locust/k6) | Gap P2 | 2d |
| PG-I15 | Secret rotation / vault | Gap P2 | 2d |
| W-IT-03 | SSO / LDAP integration ready | Wow P2 | 2d |
| W-OPS-02 | Bulk Alert Triage | Wow P2 | 2d |
| W-AUD-03 | Segregation of Duties Report | Wow P2 | 2d |

**Sprint 4 Total: ~24 days → 3 devs × 5 days**

---

### Sprint 5 — Week 5: Polish + Future-Proofing (5 items)
| ID | Item | Type | Effort |
|----|------|------|--------|
| PG-F06 | ML / AI models (anomaly detection) | Gap P2 | 5d |
| PG-F11 | Accessibility (WCAG 2.1) | Gap P2 | 3d |
| PG-I12 | Infrastructure as Code (Terraform + azurerm) | Gap P2 | 3d |
| W-CRO-05 | Peer Benchmarking | Wow P3 | 2d |
| W-CO-05 | Regulatory Change Impact Analysis | Wow P3 | 3d |
| W-OPS-03 | Mobile-Responsive Design | Wow P3 | 3d |

**Sprint 5 Total: ~19 days → 2 devs × 5 days**

---

## Already Done (3 items)
| ID | Item |
|----|------|
| W-CO-02 | Auto-generated SAR Narrative (ai_agent module) |
| W-IT-02 | RBAC with Maker-Checker (maker_checker service) |
| W-OPS-01 | Customer 360 Single View (Customer360Page) |

---

## Priority Distribution

```
P0 (Blockers)  ████████  8 items  — Must fix before any bank deployment
P1 (Critical)  █████████████████████  21 items  — Must fix before UAT
P2 (High)      ████████████████  16 items  — Must fix before go-live
P3 (Medium)    ██  2 items  — Nice to have for first release
Done           ███  3 items  — Already built
```

## Stakeholder Impact

| Stakeholder | Wow Features | Directly Benefits From |
|-------------|-------------|----------------------|
| CRO | 6 (1 done partial) | Risk Heatmap, Board Report, What-If, Peer Benchmark |
| Compliance Officer | 6 (1 done) | RBI Scorecard, Filing Tracker, Audit Export, SAR Narrative |
| Risk Manager | 6 (0 done) | Alert Tuning, Investigation Copilot, Force-Graph, Backtesting |
| IT / InfoSec | 3 (1 done) | API Health, Maker-Checker, SSO Ready |
| Operations | 3 (1 done) | Customer 360, Bulk Triage, Mobile Responsive |
| Internal Audit | 3 (0 done) | Hash Chain Audit, User Analytics, SoD Report |
