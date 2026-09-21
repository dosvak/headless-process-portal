# Test report - 2026-09-11 (live mode against the lab Process Center 8.6.2)

| Suite | Result |
|---|---|
| Unit tests (`npx ng test --watch=false`, Vitest) | 9 passed (form renderer, engine serialisation, error text, pipes) |
| Sample application over REST (`tools/hdls_rest_test.py` in the BAW workspace) | 21 checks, 0 failed: start, form contract, claim, completion with output mapping, gateways, loop, end states |
| End-to-end through the Angular UI on the public demo (`e2e/live_e2e.py https://headless.quickpod.org`, Cloudflare proxy + nginx proxy to the engine) | 42 checks, 0 failed (same suite) |
| End-to-end through the Angular UI (`e2e/live_e2e.py`, Playwright, dev server with the lab proxy) | **42 checks, 0 failed**; the only failed engine call is the deliberate wrong-password sign-in (401) |

Instances started by the run: Expense Approval #1643, Customer Onboarding #1644, Support Ticket #1645.

## End-to-end checks

| Area | Check | Result | Detail |
|---|---|---|---|
| Sign-on | wrong password is refused by the engine | OK |  |
| Sign-on | valid credentials open the Work page with the user in the header | OK | http://localhost:4200/work |
| Sign-on | sign out returns to the login page | OK |  |
| Launch | exposed processes listed with the Headless Sample processes | OK | 3 processes |
| Launch | Expense Approval: start form generated from the process model | OK | 5 fields |
| Launch | Expense Approval: process started | OK | Process started: Expense E2E Alice 088118 321.5 EUR (#1643)
Open first task |
| Launch | Customer Onboarding: start form generated from the process model | OK | 3 fields |
| Launch | Customer Onboarding: process started | OK | Process started: Onboarding E2E Corp 088118 (#1644)
Open first task |
| Launch | Support Ticket: start form generated from the process model | OK | 3 fields |
| Launch | Support Ticket: process started | OK | Process started: Ticket E2E ticket 088118 (#1645)
Open first task |
| Work | Team tasks lists the new headless tasks (Approve expense, Verify documents, Resolve ticket) | OK | 25 rows: ['Step: Verify documents', 'Step: Resolve ticket', 'Step: Verify documents', 'Step: Resolve ticket', 'Step: Ver |
| Work | stats header (open, on track, at risk, overdue, high) | OK | ['41', '41', '0', '0', '2'] |
| Work | quick search filters by subject | OK | ['Step: Approve expense', 'Step: Approve expense', 'Step: Approve expense'] |
| Work | row action Claim (snackbar or list confirms) | OK |  |
| Work | claimed task appears under My tasks | OK | ['Step: Approve expense', 'Step: Approve expense', 'Step: Approve expense'] |
| Work | row action Priority -> High | OK | ['HDLS', 'High'] |
| Work | saved search dialog submitted (engine list checked next) | OK |  |
| Work | saved search listed in the menu | OK | ['bookmark\nE2E search 086335', 'bookmark\nE2E search 086547', 'bookmark\nE2E search 086787', 'bookmark\nE2E search 0870 |
| Task | task page shows the headless form with the business data | OK | http://localhost:4200/task/5598 |
| Task | complete through the headless form -> back to Work | OK | http://localhost:4200/work |
| Task | the process continued: Reimburse expense task exists for the e2e instance | OK | ['Step: Reimburse expense\nExpense Grace Chen 301.96 EUR\nExpens', 'Step: Reimburse expense\nExpense E2E Alice 086335 32 |
| Task | checkbox form completed (Verify documents) | OK | http://localhost:4200/work |
| Task | Boolean outputs drove the gateway: Activate account task exists for the e2e instance | OK | ['Step: Activate account\nOnboarding Wayne Logistics\nCustomer O', 'Step: Activate account\nOnboarding Anil Singh\nCusto |
| Task | select + number form completed (Resolve ticket) | OK | http://localhost:4200/work |
| Task | Claim on the task page | OK | arrow_back
Step: Reimburse expense
Normal
Received
undo
Release
more_horiz
More
 |
| Task | comment posted to the collaboration stream | OK | Add a comment
send
celladminjust now
[Step: Reimburse expense] e2e comment 088118
Systemjust now
Step: Reimburse expense |
| Task | Release on the task page | OK |  |
| Instances | active instances listed with the status overview | OK |  |
| Instances | name filter finds the onboarding instance | OK | ['Onboarding E2E Corp 088118'] |
| Instance | instance page: tasks, current steps, facts | OK |  |
| Instance | diagram rendered from the engine model with the token highlighted | OK | 8 steps |
| Instance | variables shown | OK |  |
| Instance | instance comment added | OK |  |
| Instance | Suspend | OK |  |
| Instance | Resume | OK |  |
| Dashboards | My Work KPIs and charts | OK |  |
| Dashboards | Process Performance charts | OK |  |
| Dashboards | Team Performance table | OK |  |
| Search | global search finds the e2e tasks and instances | OK |  |
| Notifications | drawer opens | OK | notifications
 Notifications
refresh
All clear - nothing needs your attention. |
| Teams | teams of the sample app with members | OK |  |
| Profile | profile with memberships and preferences | OK |  |
