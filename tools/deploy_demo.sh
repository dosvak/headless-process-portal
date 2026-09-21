#!/usr/bin/env bash
# Build the portal and publish it on a demo host. Defaults = the permanent public demo; DEPLOY_HOST / DEPLOY_SITE / DEPLOY_CONFIG override.
#   DEPLOY_SITE=headless.quickpod.org DEPLOY_CONFIG=production tools/deploy_demo.sh      # the first demo (lab engine)
# The nginx vhost of the site serves /var/www/<site> and proxies /rest/ and /bpm/
# to the engine (engine host configured in the vhost only; no stubbed data: the demo works on a real engine).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${DEPLOY_HOST:?set DEPLOY_HOST=root@<demo host>}; SITE=${DEPLOY_SITE:-portaldemo.dosvak.com}; CFG=${DEPLOY_CONFIG:-portaldemo}
npx ng build --configuration $CFG
rsync -az --delete dist/headless-portal/browser/ $HOST:/var/www/$SITE/
ssh $HOST 'nginx -t >/dev/null 2>&1 && systemctl reload nginx'
curl -s -o /dev/null -w "https://$SITE -> %{http_code}\n" https://$SITE/
