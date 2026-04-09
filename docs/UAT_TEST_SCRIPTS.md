# FinsurgeENRIMS -- UAT Test Scripts

**Prepared for**: Bank QA Team
**Date**: 08-Apr-2026
**Version**: 1.0
**Classification**: Internal

---

## Instructions for QA Team

- Execute each test case in the order listed within each module.
- Record the actual result and mark Status as PASS, FAIL, or BLOCKED.
- For FAIL results, note the defect ID in the Remarks column.
- Test environment: Frontend at http://localhost:5173, Backend at http://localhost:8000
- Test data: Pre-seeded demo data (49 customers, 4000+ transactions, 150 alerts, 25 cases)

### Test Credentials

| Username | Role | Password |
|----------|------|----------|
| admin | System Administrator | Demo@2026 |
| sunita.krishnan | Compliance Officer | Demo@2026 |
| deepa.venkatesh | Risk Analyst | Demo@2026 |
| pradeep.mohan | Fraud Investigator | Demo@2026 |
| lakshmi.iyer | Internal Auditor | Demo@2026 |

---

## Module 1: Login and Authentication (TC-001 to TC-005)

### TC-001: Successful Login with Valid Credentials

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Title** | Successful login with valid credentials |
| **Precondition** | Application is running. User is on the login page. No active session. |
| **Steps** | 1. Navigate to http://localhost:5173 |
|  | 2. Enter username: `admin` |
|  | 3. Enter password: `Demo@2026` |
|  | 4. Click the "Sign In" button |
| **Expected Result** | User is redirected to the Executive Dashboard. The top navigation shows the user's name ("Administrator") and role. The dashboard displays KPI cards (Alerts Today, Open Cases, High-Risk Customers, Suspicious Transactions). |
| **Status** | |
| **Remarks** | |

### TC-002: Login Failure with Invalid Password

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Title** | Login failure with incorrect password |
| **Precondition** | Application is running. User is on the login page. |
| **Steps** | 1. Navigate to http://localhost:5173 |
|  | 2. Enter username: `admin` |
|  | 3. Enter password: `WrongPassword123` |
|  | 4. Click the "Sign In" button |
| **Expected Result** | An error message "Invalid credentials" is displayed. User remains on the login page. No JWT token is stored in browser storage. |
| **Status** | |
| **Remarks** | |

### TC-003: Login Failure with Non-Existent Username

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Title** | Login failure with non-existent username |
| **Precondition** | Application is running. User is on the login page. |
| **Steps** | 1. Navigate to http://localhost:5173 |
|  | 2. Enter username: `nonexistent_user` |
|  | 3. Enter password: `Demo@2026` |
|  | 4. Click the "Sign In" button |
| **Expected Result** | An error message "Invalid credentials" is displayed (same message as TC-002 -- no user enumeration). User remains on the login page. |
| **Status** | |
| **Remarks** | |

### TC-004: Access Protected Page Without Authentication

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Title** | Redirect to login when accessing protected route without token |
| **Precondition** | No active session (clear browser storage if needed). |
| **Steps** | 1. Open browser and navigate directly to http://localhost:5173/dashboard |
|  | 2. Observe the behavior |
|  | 3. Try navigating to http://localhost:5173/alerts |
|  | 4. Observe the behavior |
| **Expected Result** | User is redirected to the login page for both URLs. No dashboard or alert data is visible before authentication. |
| **Status** | |
| **Remarks** | |

### TC-005: Role-Based Navigation Visibility

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Title** | Verify navigation items match user role |
| **Precondition** | User is logged out. |
| **Steps** | 1. Login as `pradeep.mohan` (Fraud Investigator) with password `Demo@2026` |
|  | 2. Note all navigation menu items visible in the sidebar |
|  | 3. Logout |
|  | 4. Login as `sunita.krishnan` (Compliance Officer) with password `Demo@2026` |
|  | 5. Note all navigation menu items visible in the sidebar |
|  | 6. Verify that compliance-specific options (Rules management, Reports) are accessible |
| **Expected Result** | Both users see the core navigation (Dashboard, Transactions, Alerts, Cases, Customers). Compliance Officer additionally has access to Rules configuration, Regulatory Reports, and Admin functions as appropriate for their role. |
| **Status** | |
| **Remarks** | |

---

## Module 2: Transaction Monitoring (TC-006 to TC-010)

### TC-006: View Transaction List with Filters

| Field | Value |
|-------|-------|
| **ID** | TC-006 |
| **Title** | View and filter the transaction list |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). |
| **Steps** | 1. Navigate to the Transactions page from the sidebar |
|  | 2. Verify the transaction list loads with paginated results (20 per page) |
|  | 3. Apply channel filter: select "SWIFT" |
|  | 4. Verify results are filtered to show only SWIFT transactions |
|  | 5. Clear the channel filter |
|  | 6. Apply amount filter: set minimum amount to INR 5,00,000 (50000000 paise) |
|  | 7. Verify all displayed transactions have amount >= INR 5,00,000 |
| **Expected Result** | Transaction list displays with correct pagination. Channel filter shows only SWIFT transactions. Amount filter shows only high-value transactions. Each transaction row shows: reference, customer name, amount, channel, method, risk score, flagged status, and date. |
| **Status** | |
| **Remarks** | |

### TC-007: View Flagged Transactions

| Field | Value |
|-------|-------|
| **ID** | TC-007 |
| **Title** | Filter and review flagged (suspicious) transactions |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). |
| **Steps** | 1. Navigate to the Transactions page |
|  | 2. Apply the "Flagged" filter (is_flagged = true) |
|  | 3. Verify only flagged transactions are displayed |
|  | 4. Click on the first flagged transaction to view details |
|  | 5. Verify the detail view shows: transaction reference, amount, channel, risk score, flag reason, counterparty details, and location |
| **Expected Result** | Filtered list shows only flagged transactions (red flag indicator visible). Transaction detail view displays all fields including the flag_reason explaining why the rules engine flagged this transaction. Risk score is between 0 and 100. |
| **Status** | |
| **Remarks** | |

### TC-008: Transaction Search by Reference and Counterparty

| Field | Value |
|-------|-------|
| **ID** | TC-008 |
| **Title** | Search transactions by reference number and counterparty name |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). |
| **Steps** | 1. Navigate to the Transactions page |
|  | 2. In the search box, type the first few characters of a known transaction reference (e.g., "TXN") |
|  | 3. Verify search results contain matching transactions |
|  | 4. Clear the search |
|  | 5. Search for a counterparty name from the seed data |
|  | 6. Verify results show transactions involving that counterparty |
| **Expected Result** | Search works on transaction_ref, description, and counterparty_name fields (case-insensitive partial match). Results update as the user types or submits the search. |
| **Status** | |
| **Remarks** | |

### TC-009: Transaction Statistics Dashboard

| Field | Value |
|-------|-------|
| **ID** | TC-009 |
| **Title** | View transaction statistics summary |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). |
| **Steps** | 1. Navigate to the Dashboard (Executive Dashboard) |
|  | 2. Locate the channel analytics section |
|  | 3. Verify it shows transaction counts by channel (Branch, ATM, Internet Banking, Mobile Banking, POS, SWIFT) |
|  | 4. Verify the Suspicious Transactions KPI card shows a count > 0 |
| **Expected Result** | Dashboard displays channel analytics chart with breakdown across all 6 channels. Suspicious Transactions count matches the number of flagged transactions in the database. All numbers are non-negative integers. |
| **Status** | |
| **Remarks** | |

### TC-010: Create New Transaction and Trigger Rules Engine

| Field | Value |
|-------|-------|
| **ID** | TC-010 |
| **Title** | Submit a new transaction and verify rules engine evaluation |
| **Precondition** | Logged in as `admin` (System Administrator). Know a valid customer_id and account_id from seed data (e.g., CIF-1001, their savings account). API access available via browser dev tools or Postman. |
| **Steps** | 1. Send a POST request to `/api/v1/transactions` with a valid JSON body: customer_id, account_id, transaction_type: "debit", transaction_method: "cash_withdrawal", channel: "branch", amount: 900000000 (INR 9,00,000 -- just below CTR threshold) |
|  | 2. Verify the response contains a `transaction` object and a `rules_engine` object |
|  | 3. Check the `rules_engine.rules_evaluated` count (should be > 0) |
|  | 4. Check if `rules_engine.is_flagged` is true |
|  | 5. Navigate to Alerts page and check if a new alert was created for this transaction |
| **Expected Result** | Transaction is created successfully with a transaction_ref. Rules engine evaluates all enabled rules. For a cash transaction of INR 9,00,000, structuring detection rules should match (amount close to INR 10,00,000 threshold). A new alert is generated and visible in the Alerts list. |
| **Status** | |
| **Remarks** | |

---

## Module 3: Alert Management (TC-011 to TC-015)

### TC-011: View Alert List and Statistics

| Field | Value |
|-------|-------|
| **ID** | TC-011 |
| **Title** | View alert list with statistics summary |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). |
| **Steps** | 1. Navigate to the Alerts page from the sidebar |
|  | 2. Verify the alert list loads with paginated results |
|  | 3. Verify alert statistics are displayed: total, new, assigned, under_review, escalated, closed, overdue counts |
|  | 4. Verify each alert row shows: alert number, title, type, priority, status, customer name, risk score, SLA due date |
| **Expected Result** | Alert list shows ~150 seeded alerts. Statistics bar shows counts by status. Priority badges are color-coded (critical=red, high=orange, medium=yellow, low=green). Overdue alerts are visually indicated. |
| **Status** | |
| **Remarks** | |

### TC-012: Filter Alerts by Priority and Status

| Field | Value |
|-------|-------|
| **ID** | TC-012 |
| **Title** | Filter alerts by priority and status |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). On the Alerts page. |
| **Steps** | 1. Select priority filter: "critical" |
|  | 2. Verify only critical-priority alerts are displayed |
|  | 3. Additionally select status filter: "new" |
|  | 4. Verify results show only critical + new alerts |
|  | 5. Clear all filters |
|  | 6. Select "My Alerts" (assigned_to = me) |
|  | 7. Verify only alerts assigned to deepa.venkatesh are shown |
| **Expected Result** | Filters work independently and in combination. "My Alerts" filter correctly shows only alerts assigned to the logged-in user. Alert count updates to reflect filtered results. |
| **Status** | |
| **Remarks** | |

### TC-013: Assign Alert to Analyst

| Field | Value |
|-------|-------|
| **ID** | TC-013 |
| **Title** | Assign an unassigned alert to an analyst |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). There is at least one alert with status "new" (unassigned). |
| **Steps** | 1. Navigate to Alerts page |
|  | 2. Filter by status: "new" |
|  | 3. Click on a "new" alert to open the detail view |
|  | 4. Click the "Assign" button |
|  | 5. Select analyst: `deepa.venkatesh` from the dropdown |
|  | 6. Confirm the assignment |
|  | 7. Verify the alert status changes to "assigned" |
|  | 8. Verify the assignee name shows "Deepa Venkatesh" |
| **Expected Result** | Alert is assigned to the selected analyst. Status changes from "new" to "assigned". Assigned_at timestamp is set. The alert now appears in Deepa's "My Alerts" filter. |
| **Status** | |
| **Remarks** | |

### TC-014: Add Investigation Note to Alert

| Field | Value |
|-------|-------|
| **ID** | TC-014 |
| **Title** | Add an investigation note to an alert |
| **Precondition** | Logged in as `pradeep.mohan` (Fraud Investigator). An alert is assigned to this user or user has access. |
| **Steps** | 1. Navigate to Alerts page and open an alert in "assigned" or "under_review" status |
|  | 2. Scroll to the Notes section |
|  | 3. Enter note text: "Reviewed transaction pattern. Customer has 5 cash deposits below threshold in 7 days. Consistent with structuring. Recommending escalation." |
|  | 4. Click "Add Note" |
|  | 5. Verify the note appears in the notes list with the investigator's name and timestamp |
| **Expected Result** | Note is saved and displayed in the alert's notes section. The note shows: text, author name ("Pradeep Mohan"), and creation timestamp. Notes are in reverse chronological order (newest first). |
| **Status** | |
| **Remarks** | |

### TC-015: Close Alert with Disposition

| Field | Value |
|-------|-------|
| **ID** | TC-015 |
| **Title** | Close an alert with true positive disposition |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). There is an alert in "assigned" or "under_review" status with investigation notes. |
| **Steps** | 1. Open the alert from TC-014 (or any investigated alert) |
|  | 2. Click the "Close" button |
|  | 3. Select disposition: "True Positive" |
|  | 4. Enter reason: "Confirmed structuring pattern. Customer depositing amounts just below INR 10L threshold across multiple branches. STR to be filed." |
|  | 5. Submit the closure |
|  | 6. Verify the alert status changes to "closed_true_positive" |
|  | 7. Verify the alert no longer appears in open alerts statistics |
| **Expected Result** | Alert status is set to "closed_true_positive". Closure reason is recorded. Closed_at timestamp is set. Closed_by records the compliance officer's ID. Alert is excluded from open/active counts in the statistics. |
| **Status** | |
| **Remarks** | |

---

## Module 4: Case Management (TC-016 to TC-020)

### TC-016: Promote Alert to Investigation Case

| Field | Value |
|-------|-------|
| **ID** | TC-016 |
| **Title** | Promote a confirmed alert to an investigation case |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). There is an open/assigned alert that has not yet been linked to a case. |
| **Steps** | 1. Navigate to Alerts page |
|  | 2. Open an alert that is in "assigned" or "under_review" status |
|  | 3. Click the "Promote to Case" button |
|  | 4. Verify a new case is created |
|  | 5. Note the case number (format: CSE-YYYYMMDD-XXXX) |
|  | 6. Navigate to Cases page and verify the new case appears in the list |
|  | 7. Open the case and verify the alert is linked to it |
| **Expected Result** | A new case is created with: auto-generated case_number, title prefixed with "Investigation:", same customer_id and priority as the alert. The alert's case_id is updated. The alert status changes to "under_review". The case appears in the Cases list and shows alert_count = 1. |
| **Status** | |
| **Remarks** | |

### TC-017: View Case Details and Timeline

| Field | Value |
|-------|-------|
| **ID** | TC-017 |
| **Title** | View case detail page with timeline and linked alerts |
| **Precondition** | Logged in as `pradeep.mohan` (Fraud Investigator). At least one case exists (from seed data or TC-016). |
| **Steps** | 1. Navigate to Cases page |
|  | 2. Click on a case to open the detail view |
|  | 3. Verify the case header shows: case_number, title, type, priority, status, customer name, assignee, SLA due date |
|  | 4. Navigate to the "Timeline" tab |
|  | 5. Verify timeline entries are displayed with activity type, description, user name, and timestamp |
|  | 6. Navigate to the "Alerts" tab |
|  | 7. Verify linked alerts are displayed with their details |
| **Expected Result** | Case detail page shows all metadata. Timeline shows chronological activities (created, assigned, escalated, etc.) with user attribution. Alerts tab lists all alerts linked to this case with alert_number, title, priority, and status. |
| **Status** | |
| **Remarks** | |

### TC-018: Assign and Escalate Case

| Field | Value |
|-------|-------|
| **ID** | TC-018 |
| **Title** | Assign a case to an investigator and then escalate |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). An open/unassigned case exists. |
| **Steps** | 1. Open an unassigned case from the Cases page |
|  | 2. Click "Assign" and select `pradeep.mohan` (Fraud Investigator) |
|  | 3. Verify the case status changes to "assigned" and assignee is shown |
|  | 4. Logout and login as `pradeep.mohan` |
|  | 5. Open the same case |
|  | 6. Click "Escalate" |
|  | 7. Enter escalation reason: "High-value structuring pattern detected. Requires Compliance Head review for potential STR filing." |
|  | 8. Select escalation target: `sunita.krishnan` |
|  | 9. Submit the escalation |
|  | 10. Verify case status changes to "escalated" |
| **Expected Result** | Case assignment works correctly with status change and timestamp. Escalation updates status to "escalated", records escalation_reason, escalated_to, and escalated_at. Timeline shows both "assigned" and "escalated" entries. |
| **Status** | |
| **Remarks** | |

### TC-019: Set Case Disposition and Close

| Field | Value |
|-------|-------|
| **ID** | TC-019 |
| **Title** | Close a case with true positive disposition |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). An investigated case with evidence and notes exists. |
| **Steps** | 1. Open an escalated or under_investigation case |
|  | 2. Click "Set Disposition" |
|  | 3. Select disposition: "True Positive" |
|  | 4. Enter notes: "Investigation confirmed money laundering pattern through structuring. INR 45,00,000 deposited in 6 transactions over 5 days, all below INR 10L threshold. Customer CIF-1001 (Rajesh Mehta). STR filed with FIU-IND." |
|  | 5. Submit the disposition |
|  | 6. Verify the case status changes to "closed_true_positive" |
|  | 7. Check the timeline for the disposition entry |
| **Expected Result** | Case is closed with disposition "true_positive". Status is "closed_true_positive". Disposition notes are recorded. Closed_by and closed_at are set. Timeline shows a "disposition_set" activity. Case is excluded from open case counts on the dashboard. |
| **Status** | |
| **Remarks** | |

### TC-020: Case Statistics and Filtering

| Field | Value |
|-------|-------|
| **ID** | TC-020 |
| **Title** | Verify case statistics and list filters |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). Multiple cases in various statuses exist. |
| **Steps** | 1. Navigate to Cases page |
|  | 2. Verify case statistics bar shows counts: total, open, under_investigation, escalated, pending_regulatory, closed |
|  | 3. Filter by status: "escalated" |
|  | 4. Verify only escalated cases are shown |
|  | 5. Filter by priority: "critical" |
|  | 6. Verify results show only critical-priority cases |
|  | 7. Filter by case_type: select any available type |
|  | 8. Verify results match the selected type |
|  | 9. Clear all filters and verify the full list returns |
| **Expected Result** | Statistics accurately reflect case counts by status. Filters (status, priority, case_type, assigned_to, customer_id, search) work individually and in combination. The overdue count matches cases past their SLA. |
| **Status** | |
| **Remarks** | |

---

## Module 5: KYC / Customer Due Diligence (TC-021 to TC-025)

### TC-021: View KYC Review Queue

| Field | Value |
|-------|-------|
| **ID** | TC-021 |
| **Title** | View the KYC review queue with filters |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the KYC page from the sidebar |
|  | 2. Verify the KYC review list loads with paginated results |
|  | 3. Verify each row shows: customer name, customer number, review type, risk assessment, status, reviewer, due date |
|  | 4. Filter by status: "pending" |
|  | 5. Verify only pending reviews are shown |
|  | 6. Filter by review_type: "periodic" |
|  | 7. Verify only periodic reviews are shown |
| **Expected Result** | KYC review list displays all reviews from seed data. Filters work correctly. Review types include: initial, periodic, event_triggered. Risk assessments include: low, medium, high, very_high. Statuses include: pending, in_progress, approved, rejected. |
| **Status** | |
| **Remarks** | |

### TC-022: View KYC Review Detail with Documents and Screenings

| Field | Value |
|-------|-------|
| **ID** | TC-022 |
| **Title** | View KYC review detail including documents and screening results |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). A KYC review exists for a customer with documents and screening results. |
| **Steps** | 1. From the KYC review list, click on a review to open the detail view |
|  | 2. Verify review metadata: customer name, review type, risk assessment, status, EDD required flag |
|  | 3. Verify the Documents section shows identity documents (PAN, Aadhaar, Passport) with verification status and expiry dates |
|  | 4. Verify the Screenings section shows screening results with: type (PEP, sanctions, adverse_media), source, match status, match score |
| **Expected Result** | Review detail page shows complete KYC information. Documents list shows document_type, document_number, verified status (true/false), expiry_date. Screenings show match_found (true/false), match_score (0-100), matched_name (if found), and status. |
| **Status** | |
| **Remarks** | |

### TC-023: Approve a KYC Review

| Field | Value |
|-------|-------|
| **ID** | TC-023 |
| **Title** | Approve a pending KYC review |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). A KYC review in "pending" or "in_progress" status exists for a low-risk customer with no adverse screenings. |
| **Steps** | 1. Open a pending KYC review for a low-risk customer |
|  | 2. Review the documents and screening results |
|  | 3. Click "Approve" |
|  | 4. Verify the review status changes to "approved" |
|  | 5. Verify reviewer_name shows "Sunita Krishnan" |
|  | 6. Verify completed_date is set to today |
|  | 7. Navigate to the customer's profile and verify kyc_status is "approved" |
| **Expected Result** | KYC review is approved. The review record is updated with: status=approved, reviewer_id, completed_date. The linked customer's kyc_status is updated to "approved". |
| **Status** | |
| **Remarks** | |

### TC-024: Reject a KYC Review

| Field | Value |
|-------|-------|
| **ID** | TC-024 |
| **Title** | Reject a KYC review for a high-risk customer |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). A KYC review exists for a customer with adverse screening matches or document issues. |
| **Steps** | 1. Open a KYC review for a high-risk customer (e.g., one with PEP match or sanctions hit) |
|  | 2. Review the screening results showing match_found = true |
|  | 3. Click "Reject" |
|  | 4. Verify the review status changes to "rejected" |
|  | 5. Verify reviewer_name and completed_date are set |
|  | 6. Navigate to the customer's profile and verify kyc_status is "rejected" |
| **Expected Result** | KYC review is rejected. Status updates to "rejected". Customer kyc_status updated to "rejected". This customer should be flagged for enhanced monitoring or account restrictions. |
| **Status** | |
| **Remarks** | |

### TC-025: Watchlist / Sanctions Screening Search

| Field | Value |
|-------|-------|
| **ID** | TC-025 |
| **Title** | Search the watchlist for a customer name match |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). Watchlist has seeded entries (200 entries). |
| **Steps** | 1. Navigate to the Watchlists page |
|  | 2. Verify the watchlist entries are listed with: name, source (OFAC, UN, RBI, Interpol), type, nationality, reason |
|  | 3. Use the watchlist search function to search for a name |
|  | 4. Set threshold to 75% |
|  | 5. Submit the search |
|  | 6. Verify results show matches with match_score percentage |
|  | 7. Verify results include alias matches if applicable |
| **Expected Result** | Watchlist search uses fuzzy matching (SequenceMatcher) with configurable threshold. Results are sorted by match_score descending. Each result shows: full_name, matched_alias (if matched via alias), list_source, match_score, nationality, reason. Maximum 20 results returned. |
| **Status** | |
| **Remarks** | |

---

## Module 6: Rules Engine (TC-026 to TC-030)

### TC-026: View All Detection Rules

| Field | Value |
|-------|-------|
| **ID** | TC-026 |
| **Title** | View the complete list of detection rules |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the Rules page from the sidebar |
|  | 2. Verify the rules list loads showing all 26 pre-built rules |
|  | 3. Verify each rule shows: name, description, category, subcategory, severity, enabled status, priority, detection count |
|  | 4. Verify rule categories include: AML, Fraud, KYC, Compliance |
|  | 5. Filter by category: "AML" |
|  | 6. Verify only AML rules are displayed |
|  | 7. Filter by severity: "critical" |
|  | 8. Verify only critical-severity rules are displayed |
| **Expected Result** | 26 rules displayed with correct metadata. Rules are ordered by priority then name. Category filter and severity filter work correctly. Detection count shows how many times each rule has triggered. |
| **Status** | |
| **Remarks** | |

### TC-027: View Rule Detail with Conditions

| Field | Value |
|-------|-------|
| **ID** | TC-027 |
| **Title** | View detailed rule configuration including conditions and actions |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. From the Rules list, click on a structuring detection rule (e.g., "Cash Structuring Detection") |
|  | 2. Verify the rule detail shows: name, description, category, subcategory, severity, enabled status |
|  | 3. Verify the conditions object shows: logic (AND/OR), nested conditions with field, operator, and value |
|  | 4. Verify the actions array shows: action type (create_alert), parameters (priority, alert_type) |
|  | 5. Verify time_window is displayed (e.g., "7d") |
|  | 6. Verify threshold_amount and threshold_count if applicable |
| **Expected Result** | Rule detail page shows the complete rule configuration. Conditions are displayed in a readable format showing the AND/OR logic tree. Fields reference transaction, customer, account, or aggregate attributes. Operators include: equals, greater_than, less_than, between, in, contains, etc. |
| **Status** | |
| **Remarks** | |

### TC-028: Toggle Rule Enable/Disable

| Field | Value |
|-------|-------|
| **ID** | TC-028 |
| **Title** | Enable and disable a detection rule |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the Rules page |
|  | 2. Find an enabled rule and note its name |
|  | 3. Click the "Toggle" button to disable the rule |
|  | 4. Verify the rule's is_enabled status changes to false |
|  | 5. Click "Toggle" again to re-enable the rule |
|  | 6. Verify the rule's is_enabled status changes back to true |
|  | 7. Filter by is_enabled: false to see all disabled rules |
| **Expected Result** | Rule toggle switches the is_enabled flag. Disabled rules are not evaluated by the rules engine (verify by checking that new transactions do not trigger disabled rules). The toggle is reflected immediately in the UI. |
| **Status** | |
| **Remarks** | |

### TC-029: View Rule Categories and Counts

| Field | Value |
|-------|-------|
| **ID** | TC-029 |
| **Title** | View rule categories with subcategory breakdown |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the Rules page |
|  | 2. Access the rule categories view (API: GET /api/v1/rules/categories) |
|  | 3. Verify categories are returned: AML, Fraud, KYC, Compliance |
|  | 4. Verify each category shows subcategories with counts |
|  | 5. Verify total rule count across all categories equals 26 |
| **Expected Result** | Categories API returns a structured object with category names, total counts, and subcategory breakdowns. AML subcategories may include: structuring, layering, round_tripping, geographic_anomaly. Fraud subcategories may include: card_fraud, identity_fraud, account_takeover, wire_fraud. |
| **Status** | |
| **Remarks** | |

### TC-030: View Rule Scenarios

| Field | Value |
|-------|-------|
| **ID** | TC-030 |
| **Title** | View detection scenarios (groups of related rules) |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the Scenarios section of the Rules page |
|  | 2. Verify the scenarios list shows: name, description, category, associated rule IDs, enabled status, detection count |
|  | 3. Click on a scenario to see its linked rules |
|  | 4. Verify the rule_ids array contains valid rule IDs |
| **Expected Result** | Scenarios group related rules into detection workflows (e.g., "Structuring Detection Scenario" groups cash threshold rules with velocity rules). Each scenario shows its component rules and aggregate detection count. Scenarios can be individually enabled/disabled. |
| **Status** | |
| **Remarks** | |

---

## Module 7: Customer 360 and Reporting (TC-031 to TC-035)

### TC-031: View Customer 360 Profile

| Field | Value |
|-------|-------|
| **ID** | TC-031 |
| **Title** | View the unified Customer 360 profile |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). A high-risk customer with transactions, alerts, and cases exists (e.g., CIF-1001 Rajesh Mehta). |
| **Steps** | 1. Navigate to the Customers page |
|  | 2. Search for "Rajesh Mehta" or "CIF-1001" |
|  | 3. Click on the customer to open their profile |
|  | 4. Click "360 View" to open the full Customer 360 page |
|  | 5. Verify the profile section shows: name, customer number, type, PAN, risk category, risk score, PEP status, KYC status, onboarding date |
|  | 6. Verify the Accounts section lists all accounts with: account number, type, balance, status |
|  | 7. Verify Recent Transactions shows last 50 transactions with: ref, type, method, channel, amount, risk score, flagged status |
|  | 8. Verify Alerts section shows customer's alerts with priority and status |
|  | 9. Verify Cases section shows linked investigation cases |
|  | 10. Verify Channel Usage shows a breakdown of transaction counts by channel |
| **Expected Result** | Customer 360 page provides a complete view of the customer. All sections populated with data. Risk score displayed as a number (0-100). Risk category shown with color indicator. PEP status clearly marked if true. Accounts, transactions, alerts, and cases are correctly linked to this customer. |
| **Status** | |
| **Remarks** | |

### TC-032: Customer List Filtering and Risk View

| Field | Value |
|-------|-------|
| **ID** | TC-032 |
| **Title** | Filter customer list by risk category and KYC status |
| **Precondition** | Logged in as `deepa.venkatesh` (Risk Analyst). |
| **Steps** | 1. Navigate to the Customers page |
|  | 2. Verify the customer list loads (49 customers) sorted by risk score descending |
|  | 3. Filter by risk_category: "very_high" |
|  | 4. Verify only very_high risk customers are displayed |
|  | 5. Clear and filter by risk_category: "high" |
|  | 6. Filter by kyc_status: "pending" |
|  | 7. Verify results show high-risk customers with pending KYC |
|  | 8. Filter by customer_type: "corporate" |
|  | 9. Verify only corporate entities are shown |
| **Expected Result** | Customer list supports all documented filters: search (name, CIF, PAN, phone), risk_category, kyc_status, customer_type. Results are paginated (20 per page). Each customer row shows: customer_number, name, type, risk_category, risk_score, PEP, KYC status, account/alert/case counts. |
| **Status** | |
| **Remarks** | |

### TC-033: Executive Dashboard KPIs and Charts

| Field | Value |
|-------|-------|
| **ID** | TC-033 |
| **Title** | Verify all executive dashboard components |
| **Precondition** | Logged in as `admin` (System Administrator) or `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the Dashboard page (should be the default landing after login) |
|  | 2. Verify KPI cards: Alerts Today, Open Cases, High-Risk Customers, Suspicious Transactions |
|  | 3. Verify the Alerts by Priority chart (bar or pie chart) |
|  | 4. Verify the Alerts by Type chart |
|  | 5. Verify the 30-Day Alert Trend line chart |
|  | 6. Verify Cases by Status breakdown |
|  | 7. Verify Risk Distribution chart (low/medium/high/very_high customer counts) |
|  | 8. Verify Channel Analytics chart |
|  | 9. Verify Recent Alerts list (top 10 most recent) |
|  | 10. Verify Top Risk Customers list (top 10 by risk score) |
|  | 11. Verify Analyst Workload table (open alerts per analyst) |
|  | 12. Verify SLA Compliance section (compliant, overdue, compliance rate percentage) |
|  | 13. Verify Monthly Stats (last 6 months: alerts, cases, transactions) |
| **Expected Result** | All 13 dashboard components render with data. Charts display correctly with legends. KPIs show non-zero values from seed data. Alert trend shows daily counts over 30 days. SLA compliance rate is calculated correctly. Monthly stats chart shows 6 months of data. |
| **Status** | |
| **Remarks** | |

### TC-034: CTR (Cash Transaction Report) List

| Field | Value |
|-------|-------|
| **ID** | TC-034 |
| **Title** | View Cash Transaction Reports for regulatory filing |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the Reports page from the sidebar |
|  | 2. Select the CTR (Cash Transaction Report) section |
|  | 3. Verify the CTR list loads showing: report number, customer name, transaction amount, transaction date, filing status, filed date |
|  | 4. Filter by filing_status: "pending" |
|  | 5. Verify only unfiled CTR reports are shown |
|  | 6. Filter by filing_status: "filed" |
|  | 7. Verify only filed reports are shown with filed_at timestamp |
| **Expected Result** | CTR reports are generated for cash transactions above the INR 10,00,000 threshold (CTR_THRESHOLD_PAISE in config). Each report shows customer details, transaction amount, and filing status. Filing statuses include: pending, filed, rejected, amended. |
| **Status** | |
| **Remarks** | |

### TC-035: SAR (Suspicious Activity Report) List

| Field | Value |
|-------|-------|
| **ID** | TC-035 |
| **Title** | View Suspicious Activity Reports for FIU-IND filing |
| **Precondition** | Logged in as `sunita.krishnan` (Compliance Officer). |
| **Steps** | 1. Navigate to the Reports page |
|  | 2. Select the SAR (Suspicious Activity Report) section |
|  | 3. Verify the SAR list loads showing: report number, case ID, customer name, suspicious activity type, total amount, date range, filing status, regulatory reference |
|  | 4. Filter by filing_status: "pending" |
|  | 5. Verify only unfiled SAR reports are shown |
|  | 6. Click on a SAR to view the narrative field |
|  | 7. Verify the narrative provides a description of the suspicious activity |
| **Expected Result** | SAR reports are linked to investigation cases. Each report shows: report_number, case_id, customer details, suspicious_activity_type, narrative text, total_amount, date_range_start/end, filing_status, regulatory_reference. The narrative field contains a textual description of the suspicious activity suitable for FIU-IND submission. |
| **Status** | |
| **Remarks** | |

---

## Test Execution Summary

| Module | Test Cases | Passed | Failed | Blocked | Not Run |
|--------|-----------|--------|--------|---------|---------|
| Login & Authentication | TC-001 to TC-005 | | | | |
| Transaction Monitoring | TC-006 to TC-010 | | | | |
| Alert Management | TC-011 to TC-015 | | | | |
| Case Management | TC-016 to TC-020 | | | | |
| KYC / CDD | TC-021 to TC-025 | | | | |
| Rules Engine | TC-026 to TC-030 | | | | |
| Customer 360 / Reporting | TC-031 to TC-035 | | | | |
| **Total** | **35** | | | | |

---

## Defect Log

| Defect ID | Test Case | Severity | Description | Assigned To | Status |
|-----------|-----------|----------|-------------|-------------|--------|
| | | | | | |
| | | | | | |
| | | | | | |

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Business Analyst | | | |
| Compliance Officer | | | |
| Project Manager | | | |

---

*This document is to be completed by the QA team during the User Acceptance Testing phase.*
*Any FAIL results must be logged as defects and resolved before production go-live.*
