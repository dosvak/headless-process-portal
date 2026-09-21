# Headless Process Portal - solution architecture

*Presented from the architect's chair: what we set out to solve, the decisions taken, how the pieces fit, and what it costs to
run and evolve.*

## 1. Problem statement and drivers

IBM Process Portal is a capable but monolithic Dojo application bound to the product's coach framework. Organisations that want
their own user experience, their own design system, or a single front end over several back ends run into three walls: the task
UI is rendered by the engine (coaches), the portal itself is a deployed process application, and every customisation lives inside
the product's release cycle.

The Headless Process Portal replaces the whole user-facing layer with a standalone Angular application that talks **only to the
process engine's REST API** (Process Center or Process Server, BAW 8.6.2 verified; the same resources exist on 20.x / 24.x and on
CP4BA). Nothing of Process Portal is used or required: no portal process application, no coach rendering, no portal-specific
services. Authentication and authorisation stay where they belong - in the engine and its security registry.

Drivers, in priority order:

1. **Total headlessness** - every screen is Angular, including the task forms. A task carries a form contract in its data; the
   portal renders it and completes the task through the API.
2. **Engine as the single source of truth** - who may see what, who may claim, complete, reassign, start: the engine decides, the
   portal displays what the engine answers.
3. **Elegance and completeness** - the feature set of Process Portal (work list, saved searches, task actions, collaboration,
   launch, instances, dashboards, search, notifications, profile, teams) in a modern, responsive, themeable UI.
4. **Demonstrability without infrastructure** - a public demo that behaves like the real thing with a simulated engine.
5. **Verifiability** - every function ratified against a real engine before it is stubbed for the demo.

## 2. Solution overview

```
 ┌──────────────────────────────── browser ────────────────────────────────┐
 │  Angular 22 application (standalone components, signals, Material 3)     │
 │  features: work | task | launch | instances | dashboards | search |      │
 │            notifications | profile | teams | login                       │
 │  core:     BpmApi (interface)  ──►  LiveApi  ──►  /rest/bpm/wle/v1  ─┐   │
 │                                ──►  StubApi  ──►  in-memory engine   │   │
 │            AuthService + interceptors (basic auth, 401 handling)     │   │
 └──────────────────────────────────────────────────────────────────────┼───┘
                                                                        │ HTTPS (same origin: dev proxy or nginx location)
 ┌──────────────────────────────────────────────────────────────────────▼───┐
 │  IBM BAW Process Center / Process Server  (classic Process REST API v1)  │
 │  security registry (WAS federated repositories / LDAP)                   │
 │  Headless Sample process application (HDLS): 3 processes, 6 headless     │
 │  tasks, 4 teams, HeadlessForm contract in the task data                  │
 └──────────────────────────────────────────────────────────────────────────┘
```

Two build configurations share one code base:

| Configuration | API implementation | Purpose |
|---|---|---|
| `development` / `production` (live) | `LiveApi` - HTTP calls to the engine through a same-origin path (`/rest`, `/bpm`) | real deployments, functional ratification on the lab |
| `demo` | `StubApi` - fixtures captured from the lab + an in-memory engine that mutates them | https://headless.quickpod.org, no engine behind it |

The switch is a single provider (`BPM_API` injection token, `apiFactory()` reads `environment.mode`). Components never know which
implementation answers.

## 3. Key architectural decisions

| # | Decision | Rationale | Consequence |
|---|---|---|---|
| 1 | **Classic Process REST API v1 only** (`/rest/bpm/wle/v1`) | It is the one API family present on every BAW generation (8.6 -> 24 -> CP4BA) with task, process, search, social and organisation resources; the v2 (`/bpm`) and Operations (`/ops`) families are incomplete for portal use on 8.6.2. | Lists use the (deprecated but complete) search query; a v2 adapter is a second `BpmApi` implementation when needed. |
| 2 | **Headless task contract in the task data** (`HeadlessForm` business object) | Web Process Designer 8.6.2 offers no External Implementation artifact; the engine cannot describe a coach's fields. A contract authored in the process (script task before the user task) is engine-neutral, versioned with the app, and testable. | Any process can adopt the contract; tasks without it fall back to a JSON editor of their data. |
| 3 | **Placeholder human services** for the sample tasks | A user task needs an implementation object; nobody renders it. | Process Portal would show the default inline form - irrelevant since the portal is not used. |
| 4 | **Basic authentication per call, validated by the engine** | Simplest integrated sign-on that works on every generation; the browser never receives a token to protect; sessions end when the tab closes. | Credentials live in session storage of the tab; the alternatives (LTPA SSO, OIDC, API gateway) are documented in SECURITY.md and plug in at the interceptor. |
| 5 | **Client-side sorting and paging over server-side filtering** | The search query sorts ascending only and caps a page at 500 rows; filters (status, text, process, app, due) are server side. | Up to 3000 rows are fetched for a view; enough for a user's or a team's work list, bounded for dashboards. |
| 6 | **Engine-derived dashboards** (searches + status overview) instead of the Performance Data Warehouse | Works on every engine without the PDW / tracking groups; numbers are live. | Trends are computed from creation / modification timestamps; historical KPIs would need the PDW. |
| 7 | **Diagram drawn from the engine model** (`diagram.step` of the instance) | The visual model service needs designer context; the instance answer already carries steps, positions, lines and the current tokens. | An SVG component, no image service, current steps highlighted. |
| 8 | **Zoneless Angular with signals** | Predictable change detection, small bundles, the modern idiom. | Third-party code that relies on zones is avoided (Chart.js is wrapped). |
| 10 | **CP4BA readiness by configuration, not by code branches** | Zen / CSRF sign-on, URL prefixes and the v2 adapter are environment choices behind the same `BpmApi`; the external-implementation contract is a second form source next to `HeadlessForm`. | docs/CP4BA.md carries the mapping and the validation plan for the lab arriving 2026-09-12. |
| 9 | **Demo = fixtures + engine simulation, not recordings** | A recording cannot claim, complete or start; the demo must behave. | The stub engine implements the sample processes' flow (task -> gateway -> next task). |

## 4. Component view

* **core/api** - `models.ts` (normalised model), `bpm-api.ts` (interface + token), `live-api.ts` (engine adapter, ~350 lines),
  `stub-api.ts` + `stub-engine.ts` (demo).
* **core/auth** - `AuthService` (sign-in, session, current user, avatar), `authInterceptor` (Authorization header on engine
  calls), `errorInterceptor` (401 -> login), `authGuard`.
* **core/layout** - `ShellComponent` (navigation, header search, theme toggle, notifications badge, user menu).
* **core/state** - `ThemeService`, `NotificationsService` (derived from the user's tasks and mentions).
* **shared/form** - `HeadlessFormComponent`: contract -> reactive form (text, textarea, number, date, select, checkbox, radio,
  required, options with value:label pairs, help texts) -> typed values.
* **shared/ui** - `DiagramComponent` (SVG), `ChartComponent` (Chart.js), `plain()` (engine serialisation -> plain JSON),
  `errorText()` (engine error bodies -> text).
* **features** - one lazy route per Process Portal area; pages hold signals and call `BpmApi` only.

## 5. Runtime flows

**Sign-on** - login page -> `AuthService.signIn` stores the credentials -> `GET /user/current` (basic auth) -> success: user,
memberships, preferences, avatar; failure: 401 -> message. Reload -> `resume()` re-validates against the engine.

**Work list** - `searchTasks(filter)` -> `PUT /search/query` (organization byTask, columns, repeated `condition` parameters,
`filterByCurrentUser` for my / team scopes) -> rows normalised -> client-side scope split (assigned to me vs available to my
teams), sort direction, paging. Stats are computed from the same rows.

**Headless task** - task page -> `GET /task/{id}?parts=all` -> `data.variables.form` (HeadlessForm) -> `HeadlessFormComponent`
-> `PUT /task/{id}?action=complete&params={outputs}` -> engine maps the outputs to the process variables -> gateway -> next task.
Save draft = `action=setData`. Claim / release / assign / priority / due / cancel = `action=assign|update|cancel`.

**Launch** - `GET /exposed/process` -> pick -> `GET /processModel/{bpdId}?snapshotId=` (inputs with types) -> generated start
form -> `POST /process?action=start&bpdId=&branchId=|snapshotId=&params=` -> instance + first task.

**Instances** - `PUT /search/query` byInstance -> `GET /process/{id}?parts=all` (tasks, variables, execution tree tokens,
diagram, comments) + `GET /process/{id}/actions` -> suspend / resume / terminate / retry / delete / due date / comment.

**Dashboards** - four searches (my open, team open, all open, closed) + two instance searches (active, completed) +
`GET /processes/status/overview` -> KPIs and Chart.js charts.

## 6. Sample application (HDLS)

Generated by `tools/build_headless_sample.py` in the BAW workspace (deterministic ids, imports on Process Center). Three
processes exposed to All Users; each user task is preceded by a script task that builds the `HeadlessForm` (title, description
composed from the business data, typed fields). Outputs flow back to process variables and drive the gateways:

| Process | Task 1 (team) | Task 2 (team) | Loop / decision |
|---|---|---|---|
| Expense Approval | Approve expense (Managers): decision radio, comment | Reimburse expense (Finance): payment reference, paid-on date | reject -> Rejected |
| Customer Onboarding | Verify documents (Operations): two checkboxes, notes | Activate account (Operations): account number, welcome e-mail sent | both verified -> activation |
| Support Ticket | Resolve ticket (Support): resolution, root cause select, minutes | Confirm resolution (Requesters = All Users): accepted radio, feedback | not accepted -> back to Resolve |

## 7. Quality, testing and operations

* `e2e/live_e2e.py` (Playwright): sign-on, launch of the three processes, work list scopes / filters / stats, row actions, saved
  search, headless completion of the three form types, process continuation, task page actions and comments, instances (filter,
  detail, diagram, variables, comment, suspend / resume), dashboards, search, notifications, teams, profile, sign-out. The same
  script runs against the demo build with `--demo`.
* `tools/hdls_rest_test.py` (BAW workspace): the sample app ratified over REST alone (start, contract, complete, gateways, loop).
* Unit tests (Vitest through the Angular CLI) for the form renderer, the stub engine and the API mappers.
* Build: `ng build` (live) / `ng build --configuration demo`; static files, no server-side code. The live build needs a reverse
  proxy that forwards `/rest/**` to the engine on the same origin (nginx `location /rest/ { proxy_pass https://engine:9443; }`).
* Demo deployment: nginx vhost `headless.quickpod.org` on the demo host serving `dist/headless-portal/browser`, certbot TLS.

## 8. Verification status (2026-09-11)

Unit tests 9 / 9, sample application over REST 21 / 21, end-to-end through the UI 42 / 42 on the lab Process Center 8.6.2
(sign-on, launch of the three processes from generated start forms, work list scopes / filters / stats / row and bulk actions /
saved searches, headless completion of radio, checkbox, select and number forms with the process continuing on the outputs, task
page claim / release / comment, instances with filter, detail, diagram with the current token, variables, comments, suspend / resume,
dashboards, search, notifications, teams, profile, sign-out). Report: docs/TEST-REPORT-2026-09-11.md.

## 9. Risks and limitations

| Risk | Mitigation |
|---|---|
| The search query API is marked deprecated | It is still served on 24.x; the adapter isolates it - the v2 `/bpm/user-tasks` and federated `/rest/bpm/federated/v1/tasks` resources are drop-in replacements in `LiveApi`. |
| Row caps (3000) on very large tenants | Filters are server side; raise the cap or move to the federated API with server-side sorting. |
| Basic authentication keeps the password in the tab session | Use SSO (LTPA cookie) or OIDC when the engine is configured for it - see SECURITY.md. |
| Task priority / due date per task in the generated sample app | Priority uses the engine default on 8.6.2 (legacy import format of non-default priorities pending); due offsets are honoured. |
| Social API availability | Comments / follow / mentions degrade gracefully when the social resources are disabled. |
