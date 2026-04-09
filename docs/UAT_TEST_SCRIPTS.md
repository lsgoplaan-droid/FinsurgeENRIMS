# FinsurgeENRIMS -- UAT Test Scripts

**Prepared for**: Bank QA Team
**Date**: 08-Apr-2026
**Version**: 1.0
**Application URL**: `http://localhost:5173` (Frontend) | `http://localhost:8000` (Backend API)
**Classification**: Internal -- QA Use Only

---

## Instructions for QA Team

- Execute each test case in the order listed within each module.
- Record the actual result and mark Status as PASS, FAIL, or BLOCKED.
- For FAIL results, note the defect ID in the Remarks column.
- Test environment: Frontend at `http://localhost:5173`, Backend API at `http://localhost:8000`
- API base path: `/api/v1`
- Test data: Pre-seeded demo data (49 customers, 4000+ transactions, 150 alerts, 25 cases, 26 rules)

### Test Credentials

| Username | Full Name | Role | Password |
|----------|-----------|------|----------|
| admin | System Admin | System Administrator | Demo@2026 |
| sunita.krishnan | Sunita Krishnan | Compliance Officer | Demo@2026 |
| deepa.venkatesh | Deepa Venkatesh | Risk Analyst | Demo@2026 |
| pradeep.mohan | Pradeep Mohan | Fraud Investigator | Demo@2026 |
| lakshmi.iyer | Lakshmi Iyer | Internal Auditor | Demo@2026 |

### Key Demo Scenarios (for reference during testing)

| Scenario | Customer | CIF | Pattern |
|----------|----------|-----|---------|
| Structuring Detection | Rajesh Mehta | CIF-1001 | Multiple cash deposits just below INR 10,00,000 |
| Layering Pattern | Hassan Trading LLC | CIF-1003 | Rapid high-value RTGS/SWIFT transfers through connected entities |
| Card Fraud | Ananya Sharma | CIF-1010 | Card used in multiple cities within hours |
| PEP Monitoring | K. Dhanabalan | CIF-1015 | Former minister with enhanced monitoring |

### Status Legend

| Status | Meaning |
|--------|---------|
| PASS | All expected results met |
| FAIL | One or more expected results not met -- attach defect ID |
| BLOCKED | Cannot execute due to dependency or environment issue |
| N/A | Not applicable in current build |

---

## Module 1: Login and Authentication (TC-001 to TC-005)

### TC-001: Successful Login with Valid Credentials

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Title** | Successful login with valid credentials |
| **Precondition** | Application is running. User is on the login page. No active session. |

**Steps:**

1. Open browser and navigate to `http://localhost:5173`.
2. Verify the login page is displayed with username and password fields.
3. Enter username: `admin`.
4. Enter password: `Demo@2026`.
5. Click the **Sign In** button.

**Expected Result:**

- API call `POST /api/v1/auth/login` returns HTTP 200.
- Response contains `access_token` (JWT) and `user` object.
- `user` object includes: `id`, `username` = "admin", `full_name`, `department`, `is_active` = true, `roles` array containing "system_administrator", `last_login_at` (updated to current timestamp).
- User is redirected to the Executive Dashboard.
- Top navigation bar displays the user's name and role.
- Dashboard KPI cards load: Alerts Today, Open Cases, High-Risk Customers, Suspicious Transactions.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-002: Login Failure with Invalid Password

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Title** | Login rejected with incorrect password |
| **Precondition** | Application is running. User is on the login page. |

**Steps:**

1. Navigate to the login page.
2. Enter username: `admin`.
3. Enter password: `WrongPassword123!`.
4. Click the **Sign In** button.
5. Attempt with username: `nonexistent_user` and password: `Demo@2026`.

**Expected Result:**

- Step 4: API returns HTTP 401 with body `{"detail": "Invalid credentials"}`.
- Error message is displayed on the login form.
- No JWT token is issued or stored.
- User remains on the login page.
- Step 5: Same 401 response -- system does not reveal whether the username exists.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-003: Token Expiry and Re-authentication

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Title** | Expired JWT token forces re-login |
| **Precondition** | User is logged in. Token expiry configured at 30 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES=30`). |

**Steps:**

1. Log in as `deepa.venkatesh` with password `Demo@2026`.
2. Confirm the dashboard loads successfully.
3. Open browser Developer Tools > Application > Local Storage.
4. Manually modify or delete the stored JWT token value.
5. Navigate to the Transactions page (click sidebar link).

**Expected Result:**

- The API call to `/api/v1/transactions` returns HTTP 401 (Unauthorized).
- The application detects the invalid token and redirects to the login page.
- A session expired or authentication required message is displayed.
- After re-login, the application resumes normally.
- Verify that `ACCESS_TOKEN_EXPIRE_MINUTES` is set to 30 in the backend config.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-004: Role-Based Access Control

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Title** | Menu items and page access vary by user role |
| **Precondition** | All 5 demo users are active in the database. |

**Steps:**

1. Log in as `admin` (System Administrator). Record all visible sidebar menu items.
2. Navigate to Administration > Users page. Verify access.
3. Navigate to Administration > Audit Log. Verify access.
4. Log out.
5. Log in as `pradeep.mohan` (Fraud Investigator). Record all visible sidebar menu items.
6. Attempt to access the Administration pages (direct URL or API call to `GET /api/v1/admin/users`).
7. Log out.
8. Log in as `lakshmi.iyer` (Internal Auditor). Record visible menu items.
9. Attempt to toggle a rule via `POST /api/v1/rules/{rule_id}/toggle`.

**Expected Result:**

- **System Administrator** (`admin`): Full access to all modules -- Dashboard, Transactions, Alerts, Cases, Customers, KYC, Rules Engine, Network, Reports, Administration (Users, Roles, Audit Log, System Config, Health).
- **Fraud Investigator** (`pradeep.mohan`): Access to Dashboard, Transactions, Alerts, Cases, Customers, Network. Limited or no access to Administration and Rules management.
- **Internal Auditor** (`lakshmi.iyer`): Read-only access to Audit Log, Reports, Dashboard. No write access to alerts, cases, or rule toggles.
- Unauthorized API calls return HTTP 403 Forbidden.
- Navigation menu items are filtered based on the user's role permissions.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-005: Password Policy Enforcement

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Title** | Password complexity policy is enforced |
| **Precondition** | Password policy configured: `PASSWORD_MIN_LENGTH=12`, `PASSWORD_REQUIRE_UPPERCASE=True`, `PASSWORD_REQUIRE_LOWERCASE=True`, `PASSWORD_REQUIRE_DIGIT=True`, `PASSWORD_REQUIRE_SPECIAL=True`, `PASSWORD_MAX_AGE_DAYS=90`. |

**Steps:**

1. Access the change password or user creation functionality.
2. Attempt password: `short` (5 chars -- too short, no complexity).
3. Attempt password: `abcdefghijkl` (12 chars -- no uppercase, digit, or special).
4. Attempt password: `Abcdefgh1234` (12 chars -- no special character).
5. Attempt password: `ABCDEFGH12!@` (12 chars -- no lowercase).
6. Attempt password: `SecurePass@2026` (15 chars -- meets all requirements).

**Expected Result:**

- Steps 2-5: Each password is rejected with a specific error message indicating which policy requirement failed (e.g., "Password must be at least 12 characters", "Password must contain a special character").
- Step 6: Password `SecurePass@2026` is accepted (15 chars, uppercase S/P, lowercase ecurease, digits 2026, special @).
- Password policy values match backend config: min 12 chars, require upper + lower + digit + special, 90-day rotation.

| **Status** | |
|------------|---|
| **Remarks** | |

---

## Module 2: Transaction Monitoring (TC-006 to TC-010)

### TC-006: Transaction List View

| Field | Value |
|-------|-------|
| **ID** | TC-006 |
| **Title** | View paginated transaction list |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). Seed data has 4000+ transactions. |

**Steps:**

1. Click **Transactions** in the sidebar menu.
2. Observe the transaction list loads with default pagination.
3. Verify the columns displayed in the table.
4. Note the total transaction count in the pagination area.
5. Click **Next Page** to navigate to page 2.
6. Click a transaction row to open the detail view.

**Expected Result:**

- Transaction list displays 20 items per page (default `page_size=20`).
- Total count shows 4000+ transactions from seed data.
- Columns visible: Transaction Ref (TXN...), Date, Customer Name, Account Number, Type (credit/debit), Method (cash, cheque, rtgs, neft, swift, card, upi), Channel (branch, atm, internet_banking, mobile_banking, pos, swift), Amount (INR), Risk Score (0-100), Flagged indicator.
- Transactions are sorted by date descending (most recent first).
- Page 2 shows a different set of 20 transactions.
- Clicking a row opens full transaction detail with counterparty info, location, processing status.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-007: Transaction Filters

| Field | Value |
|-------|-------|
| **ID** | TC-007 |
| **Title** | Filter transactions by channel, amount, date, flagged status, and search |
| **Precondition** | Logged in as `deepa.venkatesh`. On the Transactions page. |

**Steps:**

1. Apply filter: **Channel** = `swift`. Note the result count.
2. Clear filter. Apply: **Min Amount** = `500000`, **Max Amount** = `10000000`. Note results.
3. Clear filters. Apply: **Date From** = `2026-01-01`, **Date To** = `2026-03-31`. Note results.
4. Clear filters. Apply: **Flagged** = `true`. Note count of flagged transactions.
5. Clear filters. Enter **Search** = `Mehta` in the search box. Note results.
6. Apply combined filters: **Channel** = `branch`, **Flagged** = `true`, **Min Amount** = `800000`.

**Expected Result:**

- Step 1: Only SWIFT channel transactions are displayed. Total is less than unfiltered total.
- Step 2: Only transactions within the amount range (5 lakh to 1 crore paise) are shown.
- Step 3: Only Q1 2026 transactions are displayed.
- Step 4: Only flagged transactions shown. Each has `is_flagged = true` and a non-empty `flag_reason`.
- Step 5: Search returns transactions where reference, description, or counterparty name contains "Mehta".
- Step 6: Combined filters apply AND logic -- only flagged branch transactions above 8 lakh paise.
- All filters correspond to query params: `channel`, `min_amount`, `max_amount`, `date_from`, `date_to`, `is_flagged`, `search`.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-008: Flagged Transaction Detail

| Field | Value |
|-------|-------|
| **ID** | TC-008 |
| **Title** | View full details of a flagged transaction |
| **Precondition** | Logged in as `deepa.venkatesh`. Flagged transactions exist in seed data. |

**Steps:**

1. Navigate to Transactions and filter by **Flagged** = `true`.
2. Click on the first flagged transaction to open its detail view.
3. Review all data fields displayed.
4. Note the `flag_reason` text.
5. Call `GET /api/v1/transactions/{transaction_id}` to verify API response matches UI.

**Expected Result:**

- Transaction detail displays all fields:
  - `id`, `transaction_ref` (TXN...), `account_id`, `customer_id`, `customer_name`, `account_number`.
  - `transaction_type` (credit or debit), `transaction_method`, `channel`.
  - `amount` (in paise), `currency` (INR), `balance_after`.
  - `counterparty_name`, `counterparty_account`, `counterparty_bank`.
  - `description`, `location_city`, `location_country`.
  - `risk_score` (> 0 for flagged), `is_flagged` = true, `flag_reason` (non-empty).
  - `transaction_date`, `processing_status` (completed), `created_at`.
- `flag_reason` contains a meaningful rule-based description (e.g., "Structuring detection: multiple cash deposits below reporting threshold").
- All fields in the API response match the UI display.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-009: Create Transaction and Trigger Rules Engine

| Field | Value |
|-------|-------|
| **ID** | TC-009 |
| **Title** | Create a new transaction that triggers a detection rule and generates an alert |
| **Precondition** | Logged in as `admin`. Customer CIF-1001 (Rajesh Mehta) exists. His savings account ID is known. Structuring detection rule is enabled. |

**Steps:**

1. Identify Rajesh Mehta's customer ID and savings account ID from `GET /api/v1/customers?search=Rajesh`.
2. Create a transaction via `POST /api/v1/transactions` with payload:
   ```json
   {
     "account_id": "<savings_account_id>",
     "customer_id": "<customer_id>",
     "transaction_type": "credit",
     "transaction_method": "cash",
     "channel": "branch",
     "amount": 950000,
     "description": "Cash deposit - UAT test",
     "location_city": "Mumbai",
     "location_country": "India"
   }
   ```
3. Examine the full API response, particularly the `rules_engine` section.
4. Navigate to Alerts and check for any newly generated alert.
5. Navigate to the customer's 360 view and confirm the new transaction appears.

**Expected Result:**

- Transaction created successfully. Response contains:
  - `transaction`: Object with new `transaction_ref`, populated fields, `processing_status` = "completed".
  - `rules_engine`: Evaluation result showing rules tested and any matches.
- If the structuring rule triggers (amount 9,50,000 just below INR 10,00,000 CTR threshold, combined with Rajesh Mehta's existing cash deposit pattern):
  - `rules_engine.alert_ids` contains the new alert ID.
  - `is_flagged` may be set to true.
  - `risk_score` is populated.
- New alert appears in the Alerts list with alert_type = "aml", title referencing structuring, customer = Rajesh Mehta.
- Account balance is updated (increased by 950000 for credit).
- Transaction appears in the customer's 360 view recent transactions.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-010: CSV Export of Transactions

| Field | Value |
|-------|-------|
| **ID** | TC-010 |
| **Title** | Export filtered transactions as CSV |
| **Precondition** | Logged in as any user. Transactions exist in the database. |

**Steps:**

1. Call `GET /api/v1/export/transactions` (no filters -- full export).
2. Verify the response is a CSV file download.
3. Call `GET /api/v1/export/transactions?channel=branch&is_flagged=true`.
4. Open the downloaded CSV and verify its contents.
5. Call `GET /api/v1/export/alerts` to verify alert export also works.
6. Call `GET /api/v1/export/customers` to verify customer export with PII masking.

**Expected Result:**

- Step 1-2: CSV file downloaded with filename `transactions_YYYYMMDD.csv`. Content-Type is `text/csv`.
- Step 3-4: Filtered CSV contains only branch + flagged transactions. CSV header: `Ref, Date, Customer ID, Account ID, Type, Method, Channel, Amount (INR), Risk Score, Flagged, Flag Reason, City, Country`. Amounts are in INR (divided by 100 from paise).
- Step 5: Alert CSV exports with header: `Alert #, Created, Type, Priority, Status, Customer ID, Title, Risk Score, Assigned To, SLA Due, Overdue`.
- Step 6: Customer CSV exports with PII masking -- PAN shows as `XXXXX1234X`, phone as `+91XXXXX3210`, email masked. Header: `Customer #, Name, Type, PAN (masked), Phone (masked), Email (masked), City, Risk Category, Risk Score, KYC Status, PEP`.
- Max 10,000 transactions / 5,000 alerts per export. Files open correctly in Excel.

| **Status** | |
|------------|---|
| **Remarks** | |

---

## Module 3: Alert Management (TC-011 to TC-015)

### TC-011: Alert List View with Statistics

| Field | Value |
|-------|-------|
| **ID** | TC-011 |
| **Title** | View paginated alert list and alert statistics |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). Seed data has ~150 alerts. |

**Steps:**

1. Click **Alerts** in the sidebar menu.
2. Observe the alert list and statistics summary.
3. Call `GET /api/v1/alerts/stats` to get the stats independently.
4. Verify the displayed stats match the API response.
5. Scroll through the alert list and verify column content.

**Expected Result:**

- Alert statistics show: `total` (~150), `new` count, `assigned` count, `under_review` count, `escalated` count, `closed` count, `overdue` count.
- Stats also include `by_priority` (critical, high, medium, low) and `by_type` (aml, fraud, kyc, compliance) breakdowns.
- Alert list columns: Alert # (ALT-...), Created date, Title, Alert Type, Priority (with visual indicator), Status, Customer Name, Risk Score, Assignee Name, SLA Due, Overdue flag.
- Default sort: `created_at` descending (newest first).
- Pagination: 20 per page, with total pages calculated.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-012: Filter Alerts by Status and Priority

| Field | Value |
|-------|-------|
| **ID** | TC-012 |
| **Title** | Filter alerts by status, priority, type, assignee, and overdue |
| **Precondition** | Logged in as `sunita.krishnan`. On the Alerts page. |

**Steps:**

1. Filter: **Status** = `new`. Verify all displayed alerts have status "new".
2. Clear. Filter: **Priority** = `critical`. Verify all shown have priority "critical".
3. Clear. Filter: **Alert Type** = `aml`. Verify only AML alerts shown.
4. Clear. Filter: **Assigned To** = `me`. Verify only alerts assigned to Sunita Krishnan appear.
5. Clear. Filter: **Is Overdue** = `true`. Verify only overdue alerts (past SLA) appear.
6. Combined: **Status** = `escalated`, **Priority** = `high`. Verify AND logic applied.
7. Filter: **Status** = `closed`. Verify it shows all closed dispositions (closed_true_positive, closed_false_positive, closed_inconclusive).

**Expected Result:**

- Each filter correctly restricts the displayed alerts.
- Counts update to reflect filtered totals.
- "me" in assigned_to resolves to the current user's ID server-side.
- Status = "closed" maps to all three closure statuses (true_positive, false_positive, inconclusive).
- Combined filters use AND logic.
- Search by title (`search` param) also works with other filters.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-013: Assign Alert to Analyst

| Field | Value |
|-------|-------|
| **ID** | TC-013 |
| **Title** | Assign an unassigned alert to a fraud investigator |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). At least one alert with status "new" and no assignee. |

**Steps:**

1. Filter alerts by **Status** = `new`.
2. Select an unassigned alert (assigned_to is null). Note the alert ID.
3. Open the alert detail view. Confirm status = "new" and assignee is empty.
4. Click **Assign**. Select `pradeep.mohan` (Fraud Investigator) from the user list.
5. Confirm the assignment.
6. Verify the alert detail updates.

**Expected Result:**

- API call: `POST /api/v1/alerts/{alert_id}/assign` with body `{"assigned_to": "<pradeep_mohan_user_id>"}`.
- Response shows updated alert with:
  - `status` changed from "new" to "assigned".
  - `assigned_to` set to Pradeep Mohan's user ID.
  - `assigned_at` populated with current timestamp.
  - `assignee_name` = "Pradeep Mohan".
- Alert list reflects the updated status and assignee.
- Pradeep Mohan can now see this alert when filtering by "Assigned To = me".

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-014: Escalate Alert

| Field | Value |
|-------|-------|
| **ID** | TC-014 |
| **Title** | Escalate an assigned alert to higher priority handling |
| **Precondition** | Logged in as `pradeep.mohan` (Fraud Investigator). An alert is assigned to this user with status "assigned". |

**Steps:**

1. Filter alerts by **Assigned To** = `me`, **Status** = `assigned`.
2. Select an assigned alert. Open the detail view.
3. Click the **Escalate** button.
4. Confirm the escalation.
5. Verify the alert status updates.

**Expected Result:**

- API call: `POST /api/v1/alerts/{alert_id}/escalate` returns HTTP 200.
- Alert status changes from "assigned" to "escalated".
- The alert now appears when filtering by status = "escalated".
- Alert detail view reflects the escalated status.
- The alert remains assigned to the same user (assignment is not cleared on escalation).

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-015: Close Alert with Disposition

| Field | Value |
|-------|-------|
| **ID** | TC-015 |
| **Title** | Close an alert with true_positive disposition and closure reason |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). An alert in "assigned" or "under_review" status exists. |

**Steps:**

1. Select an open alert (status: assigned, under_review, or escalated).
2. Open the alert detail view.
3. Click the **Close** button.
4. Select disposition: `true_positive`.
5. Enter reason: `"Confirmed structuring pattern. Customer Rajesh Mehta made 5 cash deposits totaling INR 47,50,000 across 5 business days, each just below INR 10,00,000 CTR threshold. Recommending case escalation and SAR filing."`.
6. Submit the closure.
7. Try closing with dispositions `false_positive` and `inconclusive` on other alerts.

**Expected Result:**

- API call: `POST /api/v1/alerts/{alert_id}/close` with body:
  ```json
  {"disposition": "true_positive", "reason": "<reason text>"}
  ```
- Alert status changes to "closed_true_positive".
- `closure_reason` field populated with the entered text.
- `closed_by` set to Sunita Krishnan's user ID.
- `closed_at` populated with current timestamp.
- Disposition "false_positive" sets status to "closed_false_positive".
- Disposition "inconclusive" sets status to "closed_inconclusive".
- Closed alerts no longer appear in "open" filters but appear under status = "closed".

| **Status** | |
|------------|---|
| **Remarks** | |

---

## Module 4: Case Management (TC-016 to TC-020)

### TC-016: Case List View with Statistics

| Field | Value |
|-------|-------|
| **ID** | TC-016 |
| **Title** | View paginated case list and case statistics |
| **Precondition** | Logged in as `pradeep.mohan` (Fraud Investigator). Seed data has 25 investigation cases. |

**Steps:**

1. Click **Cases** in the sidebar menu.
2. Observe the case list loads with pagination.
3. Call `GET /api/v1/cases/stats` to get statistics.
4. Verify columns: Case # (CSE-...), Title, Case Type, Priority, Status, Customer Name, Assignee, SLA Due, Overdue, Alert Count, Evidence Count.
5. Filter by **Status** = `open`. Filter by **Assigned To** = `me`.
6. Filter by **Priority** = `critical`. Filter by **Case Type** = `aml_investigation`.

**Expected Result:**

- Case list displays 25 cases from seed data.
- Statistics: `total` = 25, `open`, `under_investigation`, `escalated`, `pending_regulatory`, `closed`, `overdue` counts. Also `by_type` and `by_priority` breakdowns.
- Each case row shows: case number, title, case_type (e.g., aml_investigation, fraud_investigation, kyc_investigation), priority, status, customer name, assignee name, SLA due date, overdue flag, alert count (linked alerts), evidence count.
- Filters narrow results correctly. "me" resolves to Pradeep Mohan.
- Cases sorted by `created_at` descending.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-017: Create Case from Alert (Promote Alert to Case)

| Field | Value |
|-------|-------|
| **ID** | TC-017 |
| **Title** | Promote a high-priority alert to an investigation case |
| **Precondition** | Logged in as `sunita.krishnan`. A high-priority alert exists with `case_id` = null (not yet linked to a case). |

**Steps:**

1. Navigate to Alerts. Find a high-priority alert where `case_id` is null.
2. Open the alert detail view.
3. Click the **Promote to Case** button.
4. Confirm the promotion.
5. Note the returned `case_id` and `case_number`.
6. Navigate to Cases and locate the newly created case.
7. Open the case and verify its details.

**Expected Result:**

- API call: `POST /api/v1/alerts/{alert_id}/promote-to-case` returns:
  ```json
  {"case_id": "<uuid>", "case_number": "CSE-YYYYMMDD-XXXX"}
  ```
- New case created with:
  - `case_number` format: `CSE-YYYYMMDD-XXXX` (date + 4 random hex chars).
  - `title`: "Investigation: " + alert title.
  - `description`: copied from alert description.
  - `case_type`: derived from alert type (e.g., `aml_investigation`).
  - `priority`: matches alert priority.
  - `customer_id`: matches alert customer.
  - `assigned_to`: matches alert assignee (if any).
- Alert updated: `case_id` set to new case ID, `status` changed to "under_review".
- Link created in `case_alerts` junction table.
- Case appears in the Cases list.
- Case has `alert_count` >= 1.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-018: Case Timeline

| Field | Value |
|-------|-------|
| **ID** | TC-018 |
| **Title** | View investigation case activity timeline |
| **Precondition** | Logged in as `pradeep.mohan`. A case exists with activities (e.g., the case created in TC-017 or a seed data case). |

**Steps:**

1. Navigate to Cases and open a case.
2. Click on the **Timeline** tab or section.
3. Review the list of activities.
4. Call `GET /api/v1/cases/{case_id}/timeline` and compare with UI.
5. Also call `GET /api/v1/cases/{case_id}/alerts` to see linked alerts.

**Expected Result:**

- Timeline displays a chronological list of case activities (most recent first).
- Each activity includes:
  - `id`: unique activity ID.
  - `activity_type`: one of "created", "assigned", "escalated", "disposition_set", "note_added", "evidence_added", "status_change".
  - `description`: human-readable text (e.g., "Case created: Investigation of structuring").
  - `user_name`: name of the user who performed the action, or "System" for automated.
  - `old_value` / `new_value`: for state transitions (e.g., old assignee to new assignee).
  - `created_at`: ISO timestamp.
- At minimum, the "created" activity exists for any case.
- Linked alerts endpoint returns array of alert summaries with id, alert_number, title, type, priority, status, risk_score, customer_name.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-019: Add Evidence to Case

| Field | Value |
|-------|-------|
| **ID** | TC-019 |
| **Title** | Add evidence to an investigation case |
| **Precondition** | Logged in as `pradeep.mohan`. A case assigned to this user exists. |

**Steps:**

1. Navigate to Cases and open a case assigned to Pradeep Mohan.
2. Note the current `evidence_count` shown in the case detail.
3. Locate the **Evidence** section in the case view.
4. Add evidence via the available mechanism (upload/form/API).
5. Refresh the case detail and check if `evidence_count` incremented.

**Expected Result:**

- The case detail displays the current evidence count (from `CaseEvidence` model).
- Evidence can be attached to the case via the case_id.
- After adding evidence, the `evidence_count` increments.
- The `CaseEvidence` record links to the case via `case_id`.
- Note: If the evidence upload UI is not yet implemented, verify the model exists and the count is accurate by checking the API response.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-020: Set Case Disposition and Close

| Field | Value |
|-------|-------|
| **ID** | TC-020 |
| **Title** | Set final disposition on a case and close it |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). An open or under-investigation case exists. |

**Steps:**

1. Navigate to Cases and open a case with status "open" or "under_investigation".
2. Click **Set Disposition**.
3. Select disposition: `true_positive`.
4. Enter notes: `"Investigation confirmed layering pattern through three connected entities. Total suspicious amount INR 45,00,000 over 30-day period. Recommend SAR filing with FIU-IND. Case evidence includes transaction trails, network analysis, and customer statements."`.
5. Submit the disposition.
6. Verify the case is closed.
7. Check the case timeline for the disposition activity.

**Expected Result:**

- API call: `POST /api/v1/cases/{case_id}/disposition` with body:
  ```json
  {
    "disposition": "true_positive",
    "notes": "<disposition notes>"
  }
  ```
- Case updated:
  - `status` = "closed_true_positive".
  - `disposition` = "true_positive".
  - `disposition_notes` = entered text.
  - `closed_by` = Sunita Krishnan's user ID.
  - `closed_at` = current timestamp.
- New timeline activity created: `activity_type` = "disposition_set", `description` = "Disposition: true_positive", `new_value` = "true_positive".
- Case stats update: closed count +1, open count -1.
- Case no longer appears in "open" filters, appears in "closed" filters.

| **Status** | |
|------------|---|
| **Remarks** | |

---

## Module 5: KYC / Customer Due Diligence (TC-021 to TC-025)

### TC-021: KYC Review List

| Field | Value |
|-------|-------|
| **ID** | TC-021 |
| **Title** | View paginated KYC review list with filters |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). KYC reviews exist for customers in seed data. |

**Steps:**

1. Click **KYC** in the sidebar menu.
2. Observe the KYC review list loads with pagination.
3. Verify columns: Customer Name, Customer Number, Review Type, Risk Assessment, Status, Reviewer, Due Date, Completed Date, EDD Required.
4. Apply filter: **Status** = `pending`.
5. Apply filter: **Review Type** = `periodic`.
6. Apply filter: **Risk Assessment** = `high`.
7. Combine: **Status** = `pending`, **Risk Assessment** = `very_high`.

**Expected Result:**

- KYC review list displays reviews with pagination (20 per page).
- Each review shows: `customer_name`, `customer_number` (CIF-...), `review_type` (periodic/event_triggered/onboarding), `risk_assessment` (low/medium/high/very_high), `status` (pending/in_progress/approved/rejected), `reviewer_name`, `due_date`, `completed_date`, `findings`, `edd_required` flag, `next_review_date`.
- Filters narrow results correctly:
  - Status "pending" shows only pending reviews.
  - Review type "periodic" shows only periodic reviews (per RBI KYC Direction Section 38).
  - Risk assessment "high" shows only high-risk reviews.
- Combined filters apply AND logic.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-022: Approve KYC Review

| Field | Value |
|-------|-------|
| **ID** | TC-022 |
| **Title** | Approve a pending KYC review |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). A pending KYC review exists. |

**Steps:**

1. Filter KYC reviews by **Status** = `pending`.
2. Select a pending review for a low- or medium-risk customer.
3. Open the review detail: `GET /api/v1/kyc/reviews/{review_id}`.
4. Examine the detail sections: review info, customer info, documents (type, number, verified, expiry), screening results (type, source, match_found, score).
5. Click **Approve**.
6. Confirm the approval.
7. Check the customer profile to verify `kyc_status` changed.

**Expected Result:**

- Review detail returns: `review` object, `customer` object (id, name, customer_number, risk_category, pep_status), `documents` array (document_type, document_number, verified status, expiry_date), `screenings` array (screening_type, source, match_found, match_score, matched_name, status).
- API call: `POST /api/v1/kyc/reviews/{review_id}/approve` returns `{"status": "approved"}`.
- Review updated: `status` = "approved", `reviewer_id` = Sunita Krishnan's ID, `completed_date` = today.
- Customer's `kyc_status` updated to "approved".
- Review no longer appears in "pending" filters.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-023: Reject KYC Review

| Field | Value |
|-------|-------|
| **ID** | TC-023 |
| **Title** | Reject a KYC review for a non-compliant customer |
| **Precondition** | Logged in as `sunita.krishnan`. A pending KYC review for a high-risk customer exists. |

**Steps:**

1. Filter KYC reviews by **Status** = `pending`, **Risk Assessment** = `high` or `very_high`.
2. Select a high-risk customer's review.
3. Open the review detail and examine documents and screening results.
4. Click **Reject**.
5. Confirm the rejection.
6. Navigate to the customer's profile and verify `kyc_status` = "rejected".

**Expected Result:**

- API call: `POST /api/v1/kyc/reviews/{review_id}/reject` returns `{"status": "rejected"}`.
- Review updated: `status` = "rejected", `reviewer_id` = Sunita Krishnan's ID, `completed_date` = today.
- Customer's `kyc_status` updated to "rejected".
- Review visible when filtering by status = "rejected".
- A rejected KYC should trigger enhanced monitoring or account restrictions per bank policy.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-024: Watchlist and Sanctions Screening Results

| Field | Value |
|-------|-------|
| **ID** | TC-024 |
| **Title** | View screening results for a PEP customer |
| **Precondition** | Logged in as `sunita.krishnan`. Customer CIF-1015 (K. Dhanabalan) is a PEP with screening results in seed data. |

**Steps:**

1. Look up customer CIF-1015 (K. Dhanabalan) via `GET /api/v1/customers?search=Dhanabalan`.
2. Note the customer ID.
3. Call `GET /api/v1/kyc/screening/{customer_id}`.
4. Review all screening results.
5. Also open the KYC review detail for this customer and check the screenings section.

**Expected Result:**

- Screening results for CIF-1015 display a list of entries, each with:
  - `screening_type`: "pep", "sanctions", "adverse_media", or similar.
  - `source`: e.g., "UN_Sanctions", "OFAC", "RBI_Watchlist", "Internal_PEP_List".
  - `match_found`: boolean. At least one should be `true` for PEP customer.
  - `match_score`: fuzzy match score (0-100). PEP match should have high score.
  - `matched_name`: the name matched against in the watchlist database.
  - `status`: "confirmed", "pending_review", or "cleared".
  - `created_at`: timestamp of when screening was performed.
- K. Dhanabalan (former minister) should show PEP match with `match_found = true`.
- Results sorted by `created_at` descending.
- This validates PMLA Section 33 and RBI KYC Direction Section 33 compliance.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-025: Expired KYC Detection

| Field | Value |
|-------|-------|
| **ID** | TC-025 |
| **Title** | Identify customers with expired KYC documents needing renewal |
| **Precondition** | Logged in as `sunita.krishnan`. Some customers have `kyc_expiry_date` in the past or KYC reviews with overdue `due_date`. |

**Steps:**

1. Navigate to the Customers page.
2. Browse the customer list and look for customers with KYC status indicating review needed.
3. Call `GET /api/v1/customers?kyc_status=pending` to find customers pending KYC.
4. Navigate to the KYC reviews page.
5. Look for reviews where `due_date` is before today (2026-04-08).
6. Cross-reference: find customers where `kyc_expiry_date` < 2026-04-08.

**Expected Result:**

- Customers with expired KYC are identifiable through:
  - `kyc_status` filter on customers list (e.g., "pending", "expired").
  - KYC reviews with `due_date` < today.
  - Customer records with `kyc_expiry_date` in the past.
- High-risk customers require annual KYC review per RBI KYC Direction Section 38:
  - High risk: annual review.
  - Medium risk: biennial review.
  - Low risk: once in 10 years.
- System tracks both `kyc_expiry_date` (document expiry) and `next_review_date` (next periodic review).
- Expired KYC customers should be prioritized in the pending review queue.

| **Status** | |
|------------|---|
| **Remarks** | |

---

## Module 6: Rules Engine (TC-026 to TC-030)

### TC-026: Rules List View

| Field | Value |
|-------|-------|
| **ID** | TC-026 |
| **Title** | View all 26 detection rules with configuration details |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). 26 rules loaded in seed data across AML, Fraud, KYC, Compliance categories. |

**Steps:**

1. Click **Rules Engine** in the sidebar menu.
2. Observe the rule list loads (default page_size = 50, showing all 26 rules).
3. Verify columns: Name, Description, Category, Subcategory, Severity, Enabled, Priority, Version, Time Window, Threshold Amount, Threshold Count, Detection Count, Last Triggered.
4. Click on any rule to see its full detail including `conditions` JSON and `actions` array.
5. Note the total rule count = 26.

**Expected Result:**

- Rule list displays all 26 rules sorted by priority then name.
- Each rule shows:
  - `name`, `description`: human-readable rule identification.
  - `category`: aml, fraud, kyc, or compliance.
  - `subcategory`: specific type (structuring, layering, card_fraud, etc.).
  - `severity`: critical, high, medium, or low.
  - `is_enabled`: boolean toggle indicator.
  - `priority`: numeric order for evaluation.
  - `version`: rule version number.
  - `time_window`: aggregation window (e.g., "24h", "7d", "30d").
  - `threshold_amount`: monetary threshold in paise.
  - `threshold_count`: transaction count threshold.
  - `detection_count`: how many times this rule has fired.
  - `last_triggered_at`: timestamp of most recent trigger.
- Rule detail shows `conditions` as a structured JSON object (with AND/OR logic, field operators, aggregate functions) and `actions` array.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-027: Toggle Rule Enable/Disable

| Field | Value |
|-------|-------|
| **ID** | TC-027 |
| **Title** | Toggle a detection rule on and off |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |

**Steps:**

1. On the Rules Engine page, identify an enabled rule (e.g., a medium-severity rule). Note its `is_enabled = true`.
2. Click the toggle switch on that rule.
3. Verify the rule is now disabled (`is_enabled = false`).
4. Click the toggle switch again.
5. Verify the rule is re-enabled (`is_enabled = true`).
6. Filter by **Enabled** = `false` to see disabled rules.

**Expected Result:**

- Step 2: API call `POST /api/v1/rules/{rule_id}/toggle` returns `{"id": "<rule_id>", "is_enabled": false}`.
- Step 3: Rule shows as disabled in the UI. Toggle indicator is off.
- Step 4: API call `POST /api/v1/rules/{rule_id}/toggle` returns `{"id": "<rule_id>", "is_enabled": true}`.
- Step 5: Rule shows as enabled again.
- Step 6: Filtering by `is_enabled=false` shows only disabled rules.
- Disabled rules are skipped during transaction evaluation by the rules engine.
- Each toggle call flips the current state (no explicit on/off -- it toggles).

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-028: Filter Rules by Category

| Field | Value |
|-------|-------|
| **ID** | TC-028 |
| **Title** | Filter rules by category, severity, and view category breakdown |
| **Precondition** | Logged in as `sunita.krishnan`. 26 rules across 4 categories. |

**Steps:**

1. Filter: **Category** = `aml`. Count the AML rules.
2. Clear. Filter: **Category** = `fraud`. Count the Fraud rules.
3. Clear. Filter: **Category** = `kyc`. Count KYC rules.
4. Clear. Filter: **Category** = `compliance`. Count compliance rules.
5. Clear. Filter: **Severity** = `critical`. Note rules across all categories.
6. Call `GET /api/v1/rules/categories` for the structured category breakdown.
7. Combine: **Category** = `aml`, **Severity** = `critical`.

**Expected Result:**

- Steps 1-4: Each category filter shows only rules of that category. Counts across all categories sum to 26.
- Step 5: Critical severity rules from all categories are displayed.
- Step 6: Categories endpoint returns:
  ```json
  {
    "aml": {"total": N, "subcategories": {"structuring": X, "layering": Y, ...}},
    "fraud": {"total": N, "subcategories": {"card_fraud": X, "identity_fraud": Y, ...}},
    "kyc": {"total": N, "subcategories": {...}},
    "compliance": {"total": N, "subcategories": {...}}
  }
  ```
  Totals across all categories sum to 26.
- Step 7: Combined filter shows only AML rules with critical severity (AND logic).

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-029: Structuring Detection Demonstration

| Field | Value |
|-------|-------|
| **ID** | TC-029 |
| **Title** | Demonstrate end-to-end structuring detection using seed data |
| **Precondition** | Logged in as `admin`. Customer CIF-1001 (Rajesh Mehta) has structuring pattern in seed data. Structuring detection rule is enabled. |

**Steps:**

1. Navigate to **Customers** and search for `Rajesh Mehta` or `CIF-1001`.
2. Open **Customer 360 View** (`GET /api/v1/customers/{customer_id}/360`).
3. In Recent Transactions, identify the structuring pattern: multiple cash deposits just below INR 10,00,000 (amounts like 9,50,000; 9,75,000; 9,80,000 paise).
4. Navigate to **Alerts** and filter by `customer_id` = CIF-1001's customer ID.
5. Find structuring-related alerts for this customer.
6. Open the alert and review the rule that triggered it.
7. Navigate to **Rules Engine** and find the structuring detection rule. Check its `detection_count`.

**Expected Result:**

- Customer 360 for Rajesh Mehta reveals:
  - Multiple cash credit transactions just below INR 10,00,000 (CTR reporting threshold).
  - Transactions clustered within short time windows (days).
  - This is a textbook structuring/smurfing pattern per PMLA Rule 3(1)(D).
- Alerts exist for CIF-1001 with:
  - `alert_type` = "aml".
  - Title/description references structuring detection.
  - `rule_name` matches the structuring detection rule.
  - `risk_score` elevated.
- The structuring detection rule has `detection_count > 0` and a populated `last_triggered_at`.
- The rule's conditions include: amount below 10,00,000 threshold, cash method, time window aggregation, minimum transaction count.
- This demonstrates compliance with PMLA Section 12(1)(a) for monitoring and detecting integrally connected transactions.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-030: Rule Simulation Mode

| Field | Value |
|-------|-------|
| **ID** | TC-030 |
| **Title** | Simulate transaction evaluation without creating real data |
| **Precondition** | Logged in as `sunita.krishnan`. Recent transactions and enabled rules exist. |

**Steps:**

1. Call `POST /api/v1/transactions/simulate` (no filter -- test all rules against recent 50 transactions).
2. Review the simulation response.
3. Identify a specific rule ID from step 2 results.
4. Call `POST /api/v1/transactions/simulate?rule_id={specific_rule_id}` to test one rule only.
5. Verify no new alerts, transactions, or cases were created by the simulation.

**Expected Result:**

- Step 2 response:
  ```json
  {
    "simulation_mode": true,
    "transactions_tested": 50,
    "rules_tested": 26,
    "matches_found": N,
    "results": [
      {
        "transaction_ref": "TXN...",
        "customer_name": "...",
        "amount": ...,
        "channel": "...",
        "method": "...",
        "date": "...",
        "rules_matched": M,
        "matched_rules": [
          {"rule_name": "...", "severity": "...", "category": "..."}
        ]
      }
    ]
  }
  ```
- `simulation_mode = true` confirms no real data created.
- `transactions_tested` up to 50 (recent transactions replayed).
- `rules_tested` = number of enabled rules (all or specific).
- Step 4: `rules_tested = 1` when filtering by specific rule ID.
- Step 5: Alert count, transaction count, and case count remain unchanged after simulation.
- Results capped at 25 entries.

| **Status** | |
|------------|---|
| **Remarks** | |

---

## Module 7: Customer 360, Network, Reporting, Dashboard, Admin (TC-031 to TC-035)

### TC-031: Customer 360 Unified View

| Field | Value |
|-------|-------|
| **ID** | TC-031 |
| **Title** | View unified Customer 360 profile with all sections |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). Customer CIF-1003 (Hassan Trading LLC) exists with accounts, transactions, alerts, cases, and network relationships. |

**Steps:**

1. Navigate to **Customers** and search for `Hassan Trading` or `CIF-1003`.
2. Click on Hassan Trading LLC to open the customer profile.
3. Click **360 View** to load the full profile (`GET /api/v1/customers/{customer_id}/360`).
4. Review each section: Customer Info, Accounts, Recent Transactions, Alerts, Cases, Channel Usage.

**Expected Result:**

- **Customer Info**: customer_number (CIF-1003), customer_type, full_name, date_of_birth, nationality, PAN, email, phone, city/state/country, occupation, employer, annual_income, source_of_funds, risk_category, risk_score, pep_status, kyc_status, kyc_expiry_date, onboarding_date, is_active, account_count, alert_count, case_count.
- **Accounts**: Array of accounts with account_number, account_type, balance, status, currency (INR), branch_code, opened_date.
- **Recent Transactions**: Last 50 transactions with transaction_ref, type, method, channel, amount, risk_score, is_flagged, date, description, counterparty_name. Expect high-value RTGS/SWIFT transfers for Hassan Trading.
- **Alerts**: Last 20 alerts with alert_number, title, alert_type, priority, status, risk_score, created_at.
- **Cases**: All linked cases with case_number, title, case_type, priority, status, created_at.
- **Channel Usage**: Transaction count by channel (branch, atm, internet_banking, mobile_banking, pos, swift). Hassan Trading likely shows heavy SWIFT/RTGS usage.
- All sections load without errors and data is consistent across sections.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-032: Network / Link Analysis

| Field | Value |
|-------|-------|
| **ID** | TC-032 |
| **Title** | View customer network graph and fund flow analysis |
| **Precondition** | Logged in as `deepa.venkatesh`. Customer CIF-1003 (Hassan Trading LLC) has network relationships in seed data. |

**Steps:**

1. Navigate to the customer profile for CIF-1003.
2. Open **Network Analysis** or call `GET /api/v1/network/{customer_id}/graph?depth=1`.
3. Observe the network graph nodes and edges.
4. Call again with `depth=2` to expand the network.
5. Call `GET /api/v1/network/{customer_id}/fund-flow` to view money movement.

**Expected Result:**

- **Network Graph (depth=1)**:
  - `nodes`: Array of customer nodes. Each has: id, label (full_name), customer_number, risk_category, risk_score, customer_type, pep_status. CIF-1003 is the center node.
  - `edges`: Array of connections. Each has: source, target, type ("relationship" or "link"), label (relationship_type or link_type), strength/detail.
  - First-degree connections only.
- **Network Graph (depth=2)**: Includes second-degree connections (connections of connections). More nodes and edges than depth=1.
- **Fund Flow**:
  - `outgoing`: Counterparties receiving funds from CIF-1003. Each entry: name, account, transaction_count, total_amount.
  - `incoming`: Counterparties sending funds to CIF-1003. Each entry: name, account, transaction_count, total_amount.
  - Aggregated by counterparty name and account.
- Network and fund flow data helps identify layering patterns and connected entity relationships.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-033: Regulatory Reporting (CTR and SAR)

| Field | Value |
|-------|-------|
| **ID** | TC-033 |
| **Title** | View CTR and SAR regulatory reports |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). CTR and SAR reports exist in seed data. |

**Steps:**

1. Navigate to the **Reports** page.
2. Open **CTR** tab. Call `GET /api/v1/reports/ctr`.
3. Verify CTR fields: report_number, customer_name, transaction_amount, transaction_date, filing_status, filed_at.
4. Open **SAR** tab. Call `GET /api/v1/reports/sar`.
5. Verify SAR fields: report_number, case_id, customer_name, suspicious_activity_type, narrative, total_amount, date_range_start, date_range_end, filing_status, regulatory_reference, filed_at.
6. Filter CTR by **Filing Status** = `pending`.
7. Filter SAR by **Filing Status** = `filed`.

**Expected Result:**

- **CTR Reports**:
  - Cash transactions above INR 10,00,000 (CTR threshold per PMLA Rule 3).
  - Fields: report_number, customer_id, customer_name, transaction_amount, transaction_date, filing_status (pending/filed/rejected), filed_at, created_at.
  - Sorted by created_at descending.
- **SAR Reports**:
  - Suspicious transaction reports linked to investigation cases.
  - Fields: report_number, case_id, customer_id, customer_name, suspicious_activity_type, narrative (detailed text), total_amount, date_range_start, date_range_end, filing_status, regulatory_reference, filed_at, created_at.
- Filing status filter works: "pending" shows unfiled reports, "filed" shows completed filings.
- CTR reports align with PMLA Rule 3 (cash > 10 lakh INR, filed within 15 days).
- SAR reports align with PMLA Section 12(1)(b) (filed within 7 days of suspicion confirmation).

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-034: Executive Dashboard

| Field | Value |
|-------|-------|
| **ID** | TC-034 |
| **Title** | Verify all executive dashboard KPIs, charts, and data accuracy |
| **Precondition** | Logged in as `admin`. All seed data loaded. |

**Steps:**

1. Navigate to the **Dashboard** (landing page).
2. Verify KPI cards: Alerts Today, Open Cases, High-Risk Customers, Suspicious Transactions.
3. Verify charts: Alerts by Priority, Alerts by Type, 30-Day Alert Trend, Cases by Status, Risk Distribution, Channel Analytics.
4. Verify tables/sections: Recent Alerts (top 10), Top Risk Customers (top 10), Analyst Workload, SLA Compliance, Monthly Stats (6 months).
5. Call `GET /api/v1/dashboard/executive` and compare JSON with UI.
6. Call `GET /api/v1/dashboard/risk-heatmap` and verify the matrix data.

**Expected Result:**

- **KPI Cards**: All show non-zero values consistent with seed data.
  - High-Risk Customers: count of customers with risk_category in ["high", "very_high"].
  - Suspicious Transactions: count of transactions with is_flagged = true.
- **Alerts by Priority**: Breakdown (critical, high, medium, low) for open alerts.
- **Alerts by Type**: Breakdown (aml, fraud, kyc, compliance) for all alerts.
- **30-Day Alert Trend**: Array of 30 entries, each with date and count.
- **Cases by Status**: open, under_investigation, escalated, pending_regulatory, closed counts.
- **Risk Distribution**: low, medium, high, very_high customer counts for active customers.
- **Channel Analytics**: Transaction counts by channel.
- **Recent Alerts**: Top 10 with id, alert_number, title, priority, status, alert_type, customer_name, risk_score, created_at.
- **Top Risk Customers**: Top 10 by risk_score with id, name, customer_number, risk_score, risk_category, pep_status.
- **Analyst Workload**: Open alert count per analyst name.
- **SLA Compliance**: compliant count, overdue count, rate percentage.
- **Monthly Stats**: Last 6 months with alerts, cases, transactions per month.
- **Risk Heatmap**: 6 channels x 4 risk levels matrix with transaction counts.

| **Status** | |
|------------|---|
| **Remarks** | |

---

### TC-035: Administration -- Users, Roles, Audit Log, System Health

| Field | Value |
|-------|-------|
| **ID** | TC-035 |
| **Title** | Verify admin functions: users, roles, audit log, config, health |
| **Precondition** | Logged in as `admin` (System Administrator). |

**Steps:**

1. Navigate to **Administration > Users**. Call `GET /api/v1/admin/users`.
2. Verify the user list: at least 5 demo users with username, email, full_name, department, is_active, roles array, last_login_at.
3. Navigate to **Administration > Roles**. Call `GET /api/v1/admin/roles`.
4. Verify 6 roles with name, description, and permissions JSON array.
5. Navigate to **Administration > Audit Log**. Call `GET /api/v1/admin/audit-log`.
6. Verify paginated audit entries. Filter by user_id, action, resource_type.
7. Call `GET /api/v1/admin/system-health`.
8. Call `GET /api/v1/admin/config`.
9. Call `GET /api/v1/admin/notifications`.

**Expected Result:**

- **Users** (Step 2): 5+ users listed. Each with username, email, full_name, department, is_active, roles (array of role name strings), last_login_at.
- **Roles** (Step 4): 6 roles:
  - `system_administrator` -- Full system access and configuration.
  - `compliance_officer` -- KYC reviews, rule management, regulatory reports, alert disposition.
  - `risk_analyst` -- Transaction monitoring, customer analysis, alert triage.
  - `fraud_investigator` -- Case investigation, evidence management, alert handling.
  - `internal_auditor` -- Read-only audit log, reports, dashboards.
  - `branch_manager` -- Branch-level operations.
  - Each role has `permissions` JSON array listing allowed actions.
- **Audit Log** (Step 6): Paginated entries (50 per page). Each: user_name, action, resource_type, resource_id, details, ip_address, created_at. Filterable by user_id, action, resource_type.
- **System Health** (Step 7):
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "counts": {
      "customers": 49,
      "transactions": 4000,
      "alerts": 150,
      "cases": 25,
      "users": 5
    }
  }
  ```
  All counts match seed data (approximate).
- **Config** (Step 8): Key-value map of system configuration entries with value and description.
- **Notifications** (Step 9): Up to 50 recent notifications for current user with title, message, notification_type, is_read, link_to, created_at.

| **Status** | |
|------------|---|
| **Remarks** | |

---

## Test Execution Summary

| Module | Test IDs | Total | Pass | Fail | Blocked | N/A |
|--------|----------|-------|------|------|---------|-----|
| Login and Authentication | TC-001 to TC-005 | 5 | | | | |
| Transaction Monitoring | TC-006 to TC-010 | 5 | | | | |
| Alert Management | TC-011 to TC-015 | 5 | | | | |
| Case Management | TC-016 to TC-020 | 5 | | | | |
| KYC / CDD | TC-021 to TC-025 | 5 | | | | |
| Rules Engine | TC-026 to TC-030 | 5 | | | | |
| Customer 360, Network, Reporting, Dashboard, Admin | TC-031 to TC-035 | 5 | | | | |
| **Total** | **TC-001 to TC-035** | **35** | | | | |

---

## Defect Log

| Defect ID | Test Case | Severity | Summary | Steps to Reproduce | Assigned To | Status |
|-----------|-----------|----------|---------|---------------------|-------------|--------|
| | | | | | | |
| | | | | | | |
| | | | | | | |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Compliance Officer | | | |
| Project Manager | | | |
| Business Owner | | | |

---

*This document references the actual API endpoints, data models, and seed data of FinsurgeENRIMS. All test cases are based on the implemented backend routes at `/api/v1/` and the React frontend at `http://localhost:5173`.*
