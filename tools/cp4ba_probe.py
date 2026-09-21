#!/usr/bin/env python3
"""Probe a BAW / CP4BA Workflow server for every REST resource the Headless Portal uses (read-only), plus the v2 and federated equivalents,
and print a compatibility matrix. Authentication: basic (traditional), zen (CP4BA identity token: /v1/preauth/validateAuth +
/idprovider/v1/auth/identitytoken) or cookie (a browser session cookie header). A CSRF token is fetched from POST /bpm/system/login and
sent as BPMCSRFToken on /bpm and /ops calls.
usage: python3 tools/cp4ba_probe.py https://host[/prefix] --auth basic|zen|cookie [--user u --password p] [--zen-base https://cpd-host] [--cookie "name=value; ..."] [--insecure]
   docs: docs/CP4BA.md section 5"""
import sys, json, argparse, requests, urllib3
ap = argparse.ArgumentParser(); ap.add_argument('base'); ap.add_argument('--auth', default='basic', choices=['basic', 'zen', 'cookie']); ap.add_argument('--user'); ap.add_argument('--password'); ap.add_argument('--zen-base'); ap.add_argument('--cookie'); ap.add_argument('--insecure', action='store_true'); ap.add_argument('--rest', default='/rest/bpm/wle/v1'); ap.add_argument('--bpm', default='/bpm'); ap.add_argument('--ops', default='/ops'); ap.add_argument('--fed', default='/rest/bpm/federated/v1')
a = ap.parse_args(); base = a.base.rstrip('/')
if a.insecure: urllib3.disable_warnings()
s = requests.Session(); s.verify = not a.insecure; s.headers['Accept'] = 'application/json'
if a.auth == 'basic': s.auth = (a.user, a.password)
elif a.auth == 'cookie': s.headers['Cookie'] = a.cookie
else:
    zen = (a.zen_base or base).rstrip('/')
    r = s.get(zen + '/v1/preauth/validateAuth', auth=(a.user, a.password), timeout=60); print('zen preauth', r.status_code, r.text[:120])
    access = r.json().get('accessToken') if r.ok else None
    r = s.post(zen + '/idprovider/v1/auth/identitytoken', data={'grant_type': 'password', 'scope': 'openid', 'username': a.user, 'password': a.password}, timeout=60); print('zen identity token', r.status_code, r.text[:120])
    token = (r.json().get('access_token') if r.ok else None) or access
    if not token: sys.exit('no Zen token'); s.headers['Authorization'] = 'Bearer ' + token
csrf = None
r = s.post(base + a.bpm + '/system/login', json={'refresh_groups': False, 'requested_lifetime': 7200}, timeout=60)
if r.ok: csrf = r.json().get('csrf_token'); s.headers['BPMCSRFToken'] = csrf
print(f'csrf login {a.bpm}/system/login -> {r.status_code}{" token ok" if csrf else " " + r.text[:100]}')
CHECKS = [   # (family, purpose, method, path, params)
    ('classic', 'current user (sign-on)', 'GET', a.rest + '/user/current', {'includeEditableUserPreferences': 'true'}),
    ('classic', 'avatar', 'GET', a.rest + '/avatar/current', {}),
    ('classic', 'users listing (Teams page)', 'GET', a.rest + '/users', {'filter': 'a*', 'maxresult': 5}),
    ('classic', 'groups listing (Teams page)', 'GET', a.rest + '/groups', {'filter': 'tw_*'}),
    ('classic', 'task list (Work)', 'PUT', a.rest + '/search/query', {'organization': 'byTask', 'columns': 'taskId,taskSubject,taskStatus', 'condition': 'taskStatus|Equals|New_or_Received', 'size': 3}),
    ('classic', 'instance list', 'PUT', a.rest + '/search/query', {'organization': 'byInstance', 'columns': 'instanceId,instanceName,bpdName,instanceStatus', 'size': 3}),
    ('classic', 'exposed processes (Launch)', 'GET', a.rest + '/exposed/process', {}),
    ('classic', 'process apps', 'GET', a.rest + '/processApps', {}),
    ('classic', 'saved searches', 'GET', a.rest + '/searches/tasks', {}),
    ('classic', 'status overview', 'GET', a.rest + '/processes/status/overview', {}),
    ('classic', 'mentions (notifications)', 'GET', a.rest + '/social/instances/mentions', {}),
    ('classic', 'systems', 'GET', a.rest + '/systems', {}),
    ('v2', 'swagger', 'GET', a.bpm + '/docs', {}),
    ('v2', 'user tasks', 'GET', a.bpm + '/user-tasks', {'states': 'ready,claimed', 'size': 3}),
    ('v2', 'processes', 'GET', a.bpm + '/processes', {'states': 'running', 'size': 3}),
    ('ops', 'swagger', 'GET', a.ops + '/docs', {}),
    ('ops', 'process count (administrator)', 'GET', a.ops + '/std/bpm/processes/count', {'states': 'running'}),
    ('ops', 'containers (administrator)', 'GET', a.ops + '/std/bpm/containers', {'size': 3}),
    ('federated', 'systems', 'GET', a.fed + '/systems', {}),
    ('federated', 'launchable entities', 'GET', a.fed + '/launchableEntities', {}),
    ('federated', 'tasks (available)', 'GET', a.fed + '/tasks', {'interaction': 'available', 'size': 3}),
]
rows = []; first_task = None; first_proc = None
for fam, purpose, method, path, params in CHECKS:
    try:
        r = s.request(method, base + path, params=params, timeout=90); code = ''
        try: j = r.json(); code = (j.get('Data') or {}).get('errorNumber') or j.get('error_number') or ''
        except Exception: j = None
        if r.ok and j and 'search/query' in path and params.get('organization') == 'byTask': first_task = ((j.get('data') or {}).get('data') or [{}])[0].get('taskId')
        if r.ok and j and 'search/query' in path and params.get('organization') == 'byInstance': first_proc = ((j.get('data') or {}).get('data') or [{}])[0].get('instanceId')
        rows.append((fam, purpose, method, path, r.status_code, code))
    except Exception as e: rows.append((fam, purpose, method, path, 0, str(e)[:60]))
for purpose, path in [('task details', f'{a.rest}/task/{first_task}?parts=all'), ('task actions', f'{a.rest}/task/actions?taskIDs={first_task}'), ('task stream', f'{a.rest}/social/task/{first_task}/stream')] if first_task else []:
    r = s.get(base + path, timeout=90); rows.append(('classic', purpose, 'GET', path, r.status_code, ''))
    if purpose == 'task details' and r.ok: d = r.json().get('data', {}); print('  task clientTypes:', d.get('clientTypes'), 'externalActivityID:', d.get('externalActivityID'), 'externalActivitySnapshotID:', d.get('externalActivitySnapshotID'))
for purpose, path in [('instance details', f'{a.rest}/process/{first_proc}?parts=all'), ('instance actions', f'{a.rest}/process/{first_proc}/actions'), ('v2 instance', f'{a.bpm}/processes/2072.{first_proc}?optional_parts=data,actions')] if first_proc else []:
    r = s.get(base + path, timeout=90); rows.append(('classic' if '/rest/' in path else 'v2', purpose, 'GET', path, r.status_code, ''))
print(f"\n{'family':<10} {'purpose':<34} {'method':<5} {'HTTP':<5} {'error':<12} path")
for fam, purpose, method, path, st, code in rows: print(f"{fam:<10} {purpose[:34]:<34} {method:<5} {st:<5} {code:<12} {path[:90]}")
ok = sum(1 for r in rows if 200 <= r[4] < 300); print(f'\n{ok} of {len(rows)} calls answered 2xx')
json.dump([dict(family=f, purpose=p, method=m, path=pa, http=st, error=c) for f, p, m, pa, st, c in rows], open('cp4ba_probe.json', 'w'), indent=1)
