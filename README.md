# Headless Process Portal

A standalone Angular 22 application that replicates the functions of IBM Process Portal (BAW) headlessly: every screen is
Angular, including the task forms, and every action is a REST call to the process engine. Two modes: **live** (a Process Center /
Process Server behind a same-origin proxy) and **demo** (stubbed engine, https://headless.quickpod.org).

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - the solution as presented by its architect (drivers, decisions, components, flows, risks)
* [docs/ENDPOINTS.md](docs/ENDPOINTS.md) - the engine endpoint used by each function, with the parameters that work on 8.6.2
* [docs/SECURITY.md](docs/SECURITY.md) - the implemented sign-on and every other available security option
* [docs/PLAN.md](docs/PLAN.md) - plan and work log
* [docs/CP4BA.md](docs/CP4BA.md) - CP4BA compatibility and upgrade guide: API families, Zen / CSRF sign-on, v2 adapter mapping, external task implementations, validation plan and probe
* [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - demo host, proxy, certificates, other engines, optional offline mode
* [docs/TEST-REPORT-2026-09-11.md](docs/TEST-REPORT-2026-09-11.md) - unit, REST and end-to-end results on the lab engine

## Run

```bash
npm install --legacy-peer-deps
npx ng serve --proxy-config proxy.conf.json          # live mode against the lab (proxy.conf.json), http://localhost:4200
npx ng build --configuration demo                    # demo build (stub engine) -> dist/headless-portal/browser
python3 e2e/live_e2e.py http://localhost:4200        # Playwright end-to-end test (add --demo for the demo build)
```

Sample process application: [`packages/Headless-Sample-1.0.twx`](packages/Headless-Sample-1.0.twx) (`HDLS`; three processes -
Expense Approval, Customer Onboarding, Support Ticket - with six headless tasks, teams Managers / Finance / Operations / Support;
every task carries a `HeadlessForm` contract in its data and is completed by the portal through the REST API),
[`packages/Headless-Sample-Test-1.0.twx`](packages/Headless-Sample-Test-1.0.twx) (`HDLT`, the same processes with searchable business
data on aliases a traditional engine already registers) and their CP4BA 25.0.1 exports in [`packages/cp4ba/`](packages/cp4ba/)
(teams bound to the Cloud Pak users, `/bas` REST base URL). Import: Process Center console > *Import Process App*; CP4BA: Business
Automation Studio > *Business automations* > *Import*. The packages are generated from a declarative build in a private workspace of
Dosvak LLC.

`proxy.conf.json` targets `https://<process-center-host>:9443` - put your engine there before `ng serve`.

## CP4BA

Branch `cp4ba` carries the validation build for Cloud Pak for Business Automation (Zen identity token sign-on, BPMCSRFToken, CP4BA dev proxy, build configuration `cp4ba`); see docs/CP4BA-VALIDATION.md there. master stays the traditional-BAW build of the public demo.

## License and attribution

Apache License 2.0 - see [LICENSE](LICENSE) and [NOTICE](NOTICE). You may use, modify and redistribute this software, including in
commercial products, provided the copyright notice, the license and the NOTICE file stay with every copy (attribution to Dosvak LLC).

## About

Published by [Dosvak LLC](https://dosvak.com), an IBM Business Partner (Silver, IBM Partner Plus), as part of its open-source tooling
for IBM Business Automation Workflow. More: [github.com/dosvak](https://github.com/dosvak), questions and answers on
[bpm.tips](https://bpm.tips).

IBM, IBM Business Automation Workflow, IBM Business Process Manager and IBM Cloud Pak are trademarks or registered trademarks of
International Business Machines Corporation. This project is not affiliated with, endorsed by or supported by IBM.
