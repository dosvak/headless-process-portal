# CP4BA compatibility and upgrade guide

*How the Headless Process Portal moves from traditional BAW (8.6.2 lab, verified) to Cloud Pak for Business Automation (BAW on
containers, Workflow Center / Workflow Server), what is already known from the CP4BA as a Service tenant (BAW 8.6.9 = 24.x), and
what to verify on the new lab installation (arriving 2026-09-12).*

## 1. What stays the same

| Aspect | Traditional BAW 8.6.2 (verified) | CP4BA (tenant checks 2026-09-04/05, BAW 8.6.9) |
|---|---|---|
| Classic Process REST API `/rest/bpm/wle/v1` | complete | **served** (its API tester lives at `/bpmrest-ui/BPMRestAPITester/index.jsp`); verified 200: systems, exposed, processApps, toolkit, process?parts=all, process/errors, set variables, bulk suspend / resume, task?parts=data, user/{name}, sendMessage |
| Process REST v2 `/bpm` | served since 21.0.x, same contract | primary family on CP4BA: `/bpm/processes`, `/bpm/processes/{id}?optional_parts=data,actions`, `/bpm/user-tasks`, `/bpm/user-tasks/{id}?optional_parts=data,actions,team_details,container_data`; Swagger `GET /bpm/docs` |
| Operations REST `/ops` | served since 20.0.0.1 | served; most resources need the administrator role (403 CWTBG0632E otherwise); Swagger `GET /ops/docs` |
| Federated REST `/rest/bpm/federated/v1` | 404 on the lab | served: `/systems`, `/launchableEntities`, `/tasks` (server-side sorting, cross-system) |
| Headless task contract (`HeadlessForm` in the task data) | works | engine-neutral: the task data travels unchanged through v1 and v2 (`optional_parts=data`) |
| Sample application (HDLS TWX) | imported on Process Center | import through Workflow Center / Business Automation Studio (*Business automations > Import*); the OOB-only rule of the package (System Data, placeholder human services, no third-party toolkit) is what makes it importable |

## 2. What changes

### 2.1 Authentication and CSRF

| Item | Traditional | CP4BA |
|---|---|---|
| Sign-on of the portal | basic authentication on every call (implemented) | The Workflow route sits behind **Zen / IAM** single sign-on. Two working patterns: (a) **Zen bearer token**: `POST /v1/preauth/validateAuth` (or `GET` with basic credentials) -> `accessToken`, exchanged at `POST /idprovider/v1/auth/identitytoken` (`grant_type=password`, `scope=openid`, `username`, `password`) -> `access_token`; send `Authorization: Bearer` on the Workflow calls; (b) **browser SSO cookies** (the tenant test used the WebSEAL / IBMid login and replayed its cookies). Whether plain basic authentication reaches the Liberty registry on the new lab is the first thing to probe (some CP4BA topologies accept it on the internal route, most refuse it on the Zen route). |
| CSRF | none for `/rest`; `/bpm` and `/ops` verify `BPMCSRFToken` | `POST /bpm/system/login` (or `/ops/system/login`) with `{"refresh_groups": false, "requested_lifetime": 7200}` -> `{csrf_token, expiration}`; header `BPMCSRFToken` on every `/bpm` and `/ops` call, GET included (CWTBG0651E without it); the classic API accepts calls without the token. |
| Authorisation surface | celladmin sees everything | role based: `ACTION_VIEW_USERS` / `ACTION_VIEW_GROUPS` (users, groups listing) and project reads refused for a non-administrator; task update / assign refused for a user without the task's team (CWTBG0549E). The portal already displays engine refusals verbatim. |
| `action=js` (Execute JavaScript) | disabled on the lab | disabled (CWTBG0529E) - not used by the portal. |

**Portal changes for CP4BA sign-on** (all in `core/auth`, components untouched):

1. `environment.authMode: 'basic' | 'zen' | 'sso'` and `zenBase` (the Zen host, e.g. `https://cpd-cp4ba.apps.<cluster>`).
2. `AuthService.signIn`: for `zen`, exchange the credentials for the identity token and keep it (memory / session storage); for `sso`,
   skip the login form when `GET /user/current` already succeeds with the browser cookies.
3. `authInterceptor`: send `Authorization: Bearer <token>` (zen) instead of Basic; add `BPMCSRFToken` on `/bpm` and `/ops` calls
   (token from `POST /bpm/system/login` at sign-in, refreshed before `expiration`).
4. `errorInterceptor`: treat 401 and Zen's 302-to-login as "session expired".

### 2.2 URL scheme

Traditional: one host, paths `/rest/bpm/wle/v1`, `/bpm`, `/ops`. CP4BA: the Workflow route is `https://cpd-<ns>.apps.<cluster>/<instance>/...`
or the tenant scheme `https://<tenant>.<host>/<offering>/<env>/...` (offering `baw` | `dba`, env `dev` | `test` | `run`). Therefore
`environment.restBase`, `bpmBase`, `opsBase`, `fedBase` and the nginx `location` prefixes are configuration, never constants. On the
tenant `/pfs`, `/bas`, `/dba`, `/workplace` answered 404 - test the actual prefixes of the new lab with the probe (section 5).

### 2.3 Lists: search query -> v2 / federated

`PUT /search/query` is deprecated (still served on 24.x). The adapter isolates it; the drop-in replacements have server-side sorting
and paging and are the recommended target on CP4BA:

| Portal need | Classic (implemented) | v2 / federated equivalent |
|---|---|---|
| My open tasks | `search/query` byTask + `filterByCurrentUser` + client split | `GET /bpm/user-tasks?states=ready,claimed&size=&offset=&sort=due_date:asc` (owner filter: `assigned_to_me`-style filters vary by version - check `/bpm/docs`); federated `GET /rest/bpm/federated/v1/tasks?interaction=available|claimed&size=&sort=` |
| Team tasks | group-assigned rows | `interaction=available` (federated) / `states=ready` (v2) |
| Closed tasks | `taskStatus Equals Closed` | `states=completed` |
| Text search | `taskSubject Contains` | `search_term` (federated), `name` filters (v2) |
| Instances | `search/query` byInstance | `GET /bpm/processes?states=&containers=&search_term=&sort=&size=&offset=` (verified on the tenant) |
| Task details | `GET /task/{id}?parts=all` | `GET /bpm/user-tasks/{id}?optional_parts=data,actions,team_details,container_data` |
| Instance details | `GET /process/{id}?parts=all` | `GET /bpm/processes/{id}?optional_parts=data,actions` (+ classic `parts=all` for the execution tree and diagram) |
| Complete / claim / assign | classic `action=complete|assign` | v2 `PUT /bpm/user-tasks/{id}?action=complete|claim|assign` with a JSON body of the outputs (verify the body shape against `/bpm/docs`) |
| Start process | classic `POST /process?action=start` | v2 `POST /bpm/processes?bpd_id=&container=&version=` with the input JSON body (verify) |
| Status overview / counts | `processes/status/overview` | `GET /ops/std/bpm/processes/count?states=` (administrator role) or v2 size-1 queries per state |
| Users / groups / teams | classic `/users`, `/groups` | classic still serves `user/{name}`; listing needs the role; `GET /ops/std/bpm/installedApps/teams` (administrator) |

Implementation plan: a second adapter `V2Api implements BpmApi` (same interface, same components) selected by `environment.api =
'classic' | 'v2'`; the mapping table above is its specification; row / detail normalisation reuses `models.ts`.

### 2.4 External task implementations

| Item | Traditional 8.6.2 | CP4BA |
|---|---|---|
| Authoring | Web Process Designer offers no External Implementation (desktop Process Designer only); the sample app uses placeholder human services + the `HeadlessForm` contract | Business Automation Studio (web designer) is expected to offer **External Implementation** artifacts (verify on the new lab: *Create > External Implementation* in the Services library). If it does, a task can be implemented natively as external: no placeholder human service needed. |
| Runtime contract | the contract lives in the task data (`data.variables.form`) | with an external implementation the task carries `externalActivityID` + `externalActivitySnapshotID` (task details) and its interface is described by `GET /rest/bpm/wle/v1/externalactivity/{id}/model?snapshotId=` (inputs / outputs with types) - the same resource exists on 8.6.2 but nothing produces such tasks there. |
| Portal support | `HeadlessFormComponent` renders the `HeadlessForm` contract | add a second contract source: when a task has `externalActivityID`, fetch the external activity model and generate the form from its output parameters (types -> field types, the same mapping as the Launch start form uses for process inputs); `HeadlessForm` in the data stays as the richer, authored contract (labels, options, help). Completion is unchanged: `action=complete&params=` (classic) or the v2 complete with the output body. |
| Client type | `clientTypes: ["IBM_WLE_Coach"]` on every task today | external tasks answer `clientTypes: ["External"]` (documented values `IBM_WLE_Coach`, `External`); the portal can hide coach-only tasks of other applications instead of scoping by application acronym. |

### 2.5 Sample application on CP4BA

* Import `Headless-Sample-1.0.twx` in Studio; teams Managers / Finance / Operations / Support get the CP4BA users (LDAP / IAM users
  instead of celladmin / deadmin): edit the team members in Studio or regenerate with `MEMBERS` set to the lab users.
* Snapshots: Studio deploys named snapshots to a Workflow Server; the portal's Launch reads `GET /exposed/process` (tip on Workflow
  Center, active snapshot on Workflow Server) and starts by `branchId` (tip) or `snapshotId` (installed snapshot) - already handled.
* If External Implementation is available, add a second version of the processes whose tasks are external (generator option) and
  keep the `HeadlessForm` script task: both contract sources are then exercised.

### 2.6 CP4BA platform components the portal meets

| Component | Role for the portal |
|---|---|
| **Zen (Cloud Pak platform UI / IAM)** | Front door of every route: SSO cookie `ibm-private-cloud-session`, identity tokens (section 2.1), **Zen API keys** for technical access (`Authorization: ZenApiKey <base64(user:apikey)>`, keys created in the profile page or `POST /usermgmt/v1/user/apiKey`) - the right choice for the nginx proxy of a demo or for a server-side integration, no password stored. |
| **Business Automation Studio** (`/bas` or the BAStudio route) | Authoring and import of process applications (the TWX of the sample app), team membership editing, External Implementation artifacts (to verify), deployment to Workflow Server. |
| **Workflow Center / Workflow Server** (`/bawins1/...` or the instance prefix) | The engine the portal talks to; Workflow Center behaves like Process Center (tips, `branchId`), Workflow Server like Process Server (installed snapshots, `snapshotId`). |
| **Workplace** (`/workplace`, the CP4BA task client) | The product's own portal (coach and Case UI based) - the equivalent of Process Portal on CP4BA; the Headless Portal replaces it for headless applications and can coexist (same engine, same tasks). |
| **Process Federation Server / federated API** (`/rest/bpm/federated/v1`, Elasticsearch-backed index) | One task and launch list across Workflow systems and Case; server-side sorting and full-text search - the recommended list source when several engines exist; the index lags the engine by a few seconds (same as the classic task index). |
| **Business Automation Navigator / Case** | Case tasks show in the federated list with `systemType` `SYSTEM_TYPE_CASE`; out of scope for the headless form contract unless a Case activity carries the same data contract. |
| **Operations REST** (`/ops`) | Administration (counts, containers, servers, event manager, housekeeping); administrator role; used by the Operations CP4BA tooling, not by the portal's user functions. |

## 3. Upgrade path of an installation (traditional -> CP4BA)

1. Export the process applications from Process Center (`tools/pc_export2.py`) and import them in Studio; check the migration report
   (heritage coaches and deprecated services are flagged; the sample app has none).
2. Point the portal's nginx `location /rest/`, `/bpm/`, `/ops/` at the Workflow route (prefix per instance); set `environment`
   bases and `authMode`.
3. Run `tools/cp4ba_probe.py` (section 5): green matrix of the endpoints -> run the end-to-end suite (`e2e/live_e2e.py <url>`);
   the checks are engine-neutral.
4. Switch the adapter to v2 where the probe shows the classic resource refused or absent.

## 4. Known differences to expect (from the tenant runs)

* Operations REST counts, containers, servers, event manager tasks, teams: administrator role required (403 CWTBG0632E for a plain user).
* Classic `users` / `groups` listing: `ACTION_VIEW_USERS` / `ACTION_VIEW_GROUPS` needed (401 CWTBG0549E) - the Teams page must fall
  back to the user's own memberships (`GET /user/current`) and `GET /user/{name}` lookups.
* `/bpm` GET calls without the CSRF token: CWTBG0651E.
* v2 `size` < 500; no date filters on `/bpm/processes` (filter client side); `optional_parts=all` rejected (name the parts).
* Federated API lists the Case system as well; `launchableEntities` is the CP4BA way to list startable items across systems.
* BPEL resources answer 501 (component not configured).

## 5. Validation plan for the new lab (2026-09-12)

`tools/cp4ba_probe.py <workflow base url> --auth basic|zen|cookie [--zen-base <url>] [--user u --password p]` runs every endpoint of
docs/ENDPOINTS.md read-only (plus the v2 / federated equivalents and the Studio / Studio-less paths) and prints a matrix: HTTP status,
error code, what the portal needs from it. Order of work:

1. Probe with basic authentication; if 401 / 302 everywhere, probe with the Zen token (`--auth zen --zen-base ...`).
2. Note the URL prefixes that answer (classic, v2, ops, federated, Swagger `/bpm/docs`, `/ops/docs`).
3. Import the sample app in Studio, deploy, rerun the probe for the write paths through the portal (start, claim, complete).
4. Check the Studio library for *External Implementation*; if present, author one external task and read
   `GET /externalactivity/{id}/model` - this decides whether the second contract source (2.4) is built.
5. Run the end-to-end suite against the portal pointed at the lab; record the results in docs/TEST-REPORT-<date>.md.
