#!/usr/bin/env python3
"""Capture the demo fixtures from the lab Process Center: users, groups, exposed processes of the Headless Sample app, their process
models, open and closed tasks with details, active and completed instances with details, saved searches, status overview.
Writes public/fixtures/engine.json (loaded by the stub engine in demo mode). Personal data is limited to the lab users; extra demo
people (alice, bob, carol) are added by the stub engine itself.
usage: python3 tools/capture_fixtures.py [https://<process-center-host>:9443] [user] [password]"""
import sys, json, os, requests, urllib3
urllib3.disable_warnings()
H = sys.argv[1] if len(sys.argv) > 1 else 'https://<process-center-host>:9443'; A = (sys.argv[2] if len(sys.argv) > 2 else 'celladmin', sys.argv[3] if len(sys.argv) > 3 else '<password>')
B = H + '/rest/bpm/wle/v1'; OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'fixtures', 'engine.json')
def get(path, **params):
    r = requests.get(B + path, params=params, auth=A, verify=False, timeout=120); j = r.json(); return j.get('data', j)
def query(organization, columns, conditions, sort, size=500, **extra):
    p = [('organization', organization), ('columns', columns), ('sort', sort), ('size', str(size)), ('offset', '0')] + [('condition', c) for c in conditions] + list(extra.items())
    r = requests.put(B + '/search/query', params=p, auth=A, verify=False, timeout=120); return (r.json().get('data') or {}).get('data') or []
TASK_COLS = 'taskId,taskSubject,taskStatus,taskPriority,taskDueDate,taskReceivedDate,taskClosedDate,taskIsAtRisk,taskActivityName,assignedToUser,assignedToRole,assignedToRoleDisplayName,taskReceivedFrom,instanceId,instanceName,bpdName,bpdId,instanceStatus,instanceCreateDate,instanceModifyDate,instanceDueDate,instanceProcessApp'
INST_COLS = 'instanceId,instanceName,bpdName,bpdId,instanceStatus,instanceCreateDate,instanceModifyDate,instanceDueDate,instanceProcessApp,instanceSnapshot'
APP = 'HDLS'
fx = {'capturedAt': __import__('datetime').datetime.now().isoformat(timespec='seconds'), 'source': H}
fx['currentUser'] = get('/user/current', includeEditableUserPreferences='true')
fx['users'] = get('/users', filter='*', maxresult=100).get('users', [])
groups = get('/groups', filter='*').get('groups', [])
fx['groups'] = [g for g in groups if not g.get('deleted') and (('_T_' in g['groupName'] and APP.lower() not in g['groupName'].lower()) is False or True)][:400]
exposed = [i for i in get('/exposed/process').get('exposedItemsList', []) if i['processAppAcronym'] == APP]
fx['exposed'] = exposed
fx['models'] = {i['itemID']: get(f"/processModel/{i['itemID']}", snapshotId=i['snapshotID']) for i in exposed}
open_rows = [r for r in query('byTask', TASK_COLS, ['taskStatus|Equals|New_or_Received'], 'taskDueDate') if r.get('instanceProcessApp') == APP]
closed_rows = [r for r in query('byTask', TASK_COLS, ['taskStatus|Equals|Closed'], 'taskClosedDate') if r.get('instanceProcessApp') == APP][-60:]
fx['taskRows'] = open_rows + closed_rows
fx['tasks'] = {str(r['taskId']): get(f"/task/{r['taskId']}", parts='all') for r in fx['taskRows']}
inst_ids = sorted({r['instanceId'] for r in fx['taskRows']})
fx['instanceRows'] = [r for r in query('byInstance', INST_COLS, [], 'instanceModifyDate', size=500) if r.get('instanceProcessApp') == APP]
fx['instances'] = {}
for iid in sorted({r['instanceId'] for r in fx['instanceRows']} | set(inst_ids)):
    d = get(f'/process/{iid}', parts='all'); d['_actions'] = get(f'/process/{iid}/actions'); fx['instances'][str(iid)] = d
fx['overview'] = get('/processes/status/overview').get('overview', {})
fx['savedSearches'] = [get(f"/searches/tasks/{s['id']}") for s in get('/searches/tasks').get('definitions', []) if not str(s['name']).startswith(('IBM.', 'portal.'))]
fx['streams'] = {'task': {tid: get(f'/social/task/{tid}/stream', sort='desc', pagesize=20).get('items', []) for tid in list(fx['tasks'])[:40]}, 'instance': {iid: get(f'/social/instance/{iid}/stream', sort='desc', pagesize=20).get('items', []) for iid in list(fx['instances'])[:40]}}
json.dump(fx, open(OUT, 'w'), indent=1)
print(f"fixtures: {len(fx['users'])} users, {len(fx['groups'])} groups, {len(exposed)} processes, {len(open_rows)} open + {len(closed_rows)} closed tasks, {len(fx['instances'])} instances -> {OUT} ({os.path.getsize(OUT)//1024} KB)")
