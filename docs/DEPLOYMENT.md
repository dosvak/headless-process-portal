# Deployment

## Demo: https://headless.quickpod.org (the demo host)

User decision (2026-09-11): the demo runs **against the real lab Process Center**, reachable from the demo host through a
port mapping. The engine host name is configured only in the nginx vhost on the host, not in this repository. No data is stubbed.

* Static build: `npx ng build --configuration production` -> `dist/headless-portal/browser`.
* nginx vhost (add-on, the other vhosts of the host are untouched): root `/var/www/headless.quickpod.org`, SPA fallback to
  `index.html`, `location /rest/` and `location /bpm/` proxied to the engine host with `proxy_ssl_server_name on` and
  the `Host` header of the engine, 180 s timeouts, no buffering. TLS by certbot (`--nginx`, auto-renewal).
* Publish: `tools/deploy_demo.sh` (build + rsync + nginx reload + smoke check).
* TLS: Let's Encrypt (certbot, `/root/certbot_quickpod.sh` retry loop on the host) - on 2026-09-11 Let's Encrypt's remote validators could
  not resolve any name served by the zone's Cloudflare nameservers (even twxca.com, issued days earlier), so the user chose the
  **Cloudflare proxy** in front of the name: the vhost serves the application on port 80 when `X-Forwarded-Proto: https` arrives
  (Flexible mode) and on port 443 with a stand-in certificate (Full mode); the Let's Encrypt certificate replaces the stand-in when
  validation works again.
* Sign-in on the demo: the lab accounts (the engine authenticates; the portal keeps nothing).
* Scope: `environment.scopeApps = ['HDLS']` - only the Headless Sample application's processes, tasks, instances and teams are
  shown, because the product's own applications (Process Portal, Hiring Sample, ...) carry coach tasks that a headless portal
  cannot render.

## Any other engine

1. Serve the static build under a host name of your choice.
2. Proxy `/rest/` (and `/bpm/` when the v2 family is used) to the engine on the same origin.
3. Set `scopeApps` to your applications (or empty for everything) and `scopeTeams` accordingly in `src/environments/environment.ts`.
4. Choose the sign-on option (docs/SECURITY.md); basic authentication needs nothing on the engine.

## Local development

`npx ng serve --proxy-config proxy.conf.json` - the proxy targets https://<process-center-host>:9443 (self-signed accepted);
http://localhost:4200.

## Optional offline mode

`ng build --configuration demo` switches the API to `StubApi` (in-memory engine seeded from `public/fixtures/engine.json`,
captured with `tools/capture_fixtures.py`). Kept for offline demonstrations; not used by the public demo.
