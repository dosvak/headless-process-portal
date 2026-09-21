# CP4BA validation build (branch `cp4ba`)

Purpose: validate the Headless Portal against a Cloud Pak for Business Automation environment (short-lived)
without touching the public demo (master, https://headless.quickpod.org, traditional BAW engine).

## What differs from master

| Area | master | branch cp4ba |
|---|---|---|
| Environment | `environment.ts` / `environment.production.ts` (basic auth) | `environment.cp4ba.ts`: `authMode: 'zen'`, `zenBase: '/zen'` (build configuration `cp4ba`, `npm run build:cp4ba`) |
| Sign-on (`AuthService`) | credentials kept for the session, sent as basic authentication | `zen` mode: `GET /zen/v1/preauth/validateAuth` with the credentials -> identity token kept for the session and sent as `Authorization: Bearer`; `basic` mode unchanged. In both modes `POST /bpm/system/login` fetches a `BPMCSRFToken` (ignored when the engine has none) |
| Interceptor | Authorization on /rest, /bpm, /ops | + `BPMCSRFToken` header on /bpm and /ops when a token exists (CP4BA refuses non-GET calls without it) |
| Dev proxy | `proxy.conf.json` -> lab engine | `proxy.conf.cp4ba.js`: `/rest`, `/bpm`, `/ops`, `/teamworks` -> `CP4BA_BAW` (+ `CP4BA_PREFIX` rewrite), `/zen` -> `CP4BA_CPD` |
| Scope | HDLS | HDLS (import Headless-Sample-1.0.twx on CP4BA first; LDAP users must be members of its teams) |

The environment files of master gained the two fields `authMode: 'basic'` and `zenBase` so the same `AuthService` compiles in
every configuration; behaviour on master is unchanged (basic mode, CSRF token fetched when available and otherwise ignored).

## Run

```bash
export CP4BA_BAW=https://<baw route host>      # Workflow server / authoring route (classic /rest/bpm/wle/v1 lives here)
export CP4BA_PREFIX=                           # e.g. /bawins1 when the instance has a URL prefix, empty otherwise
export CP4BA_CPD=https://cpd-<ns>.apps.<cluster>   # Zen route (identity token)
npm run start:cp4ba                            # http://localhost:4200, sign in with an LDAP user (or cpadmin)
HP_USER=<user> HP_PASSWORD=<pwd> python3 e2e/live_e2e.py http://localhost:4200 --out e2e_cp4ba.json
```

Endpoint matrix first: `python3 tools/cp4ba_probe.py $CP4BA_BAW$CP4BA_PREFIX --auth zen --zen-base $CP4BA_CPD --user <u> --password <p> --insecure`
(docs/CP4BA.md section 5). If the classic API refuses the bearer on the BAW route, switch `authMode` to `basic` in
`environment.cp4ba.ts` (basic authentication of LDAP users on the BAW route) and re-run.

## Record

Outcome of every e2e check, the auth mode that worked, prefix, and every classic-API difference goes into docs/CP4BA.md section 5
("validated on ...") and the workspace runbook (`BAW/docs/CP4BA-VALIDATION-RUNBOOK.md`); a production deployment on CP4BA would
serve the built files from any web server with the same two proxy locations (see DEPLOYMENT.md).

## Findings on CP4BA 25.0.1 (TechZone, 2026-09-12)

* Route: everything under `https://<cpd route>/bas` (`CP4BA_BAW` = the cpd route, `CP4BA_PREFIX=/bas`, `CP4BA_CPD` = the cpd route).
* Sign-on: `authMode: 'zen'` works with the platform users (`cpmanager` = Workflow admin). Two things the proxy must do, otherwise the
  Workflow server answers **403 "This request was blocked during CSRF Filtering!"** even for the CSRF token request itself:
  strip `Set-Cookie` from every upstream answer (the Zen sign-on sets platform cookies; a cookie-bearing request without token is refused)
  and strip the browser's `Origin` / `Referer` (the dev-server origin is treated as cross-site). `proxy.conf.cp4ba.js` does both
  (Vite `configure` hook); nginx equivalent: `proxy_hide_header Set-Cookie; proxy_set_header Origin ""; proxy_set_header Referer "";`.
  The two sign-on fetches also run with `credentials: 'omit'`, and the interceptor sends `BPMCSRFToken` on every engine call.
* **Result on CP4BA 25.0.1 (TechZone, 2026-09-12): e2e 42 of 42** - sign-in (Zen token), launch of the three sample processes, team and
  personal task lists, claim / priority / saved search, headless task forms (text, checkbox, select + number), comments, release, instances
  with diagram and variables, suspend / resume, dashboards, global search, notifications, Teams page, profile, sign-out. The evening's
  Teams failure was the suite itself (it expected the lab user `celladmin` among the members; it now expects the signed-in `HP_USER`),
  and the Suspend / Resume checks now poll the instance header instead of waiting a fixed 4 s (the loaded cluster refreshed slower).
  The single console 401 in the report is the suite's deliberate wrong-password sign-on. Prerequisite on the engine side: the sample
  app's teams must contain users of that environment (`twx_upgrade.py --members ...` when packaging, new versionIds for the changed
  participants) - otherwise the team task list is empty.
