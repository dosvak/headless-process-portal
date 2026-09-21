#!/usr/bin/env python3
"""Populate the demo engine with a realistic volume of Headless Sample work spread over the demo accounts: instances are STARTED by the
demo users themselves (so "my instances" differ per user), tasks are completed / claimed by the member of the right team (managers
approve, finance reimburses, operations verifies and activates, support resolves, requesters confirm), with varied priorities, due
dates and comments. Idempotent enough to rerun (adds another batch).
usage: python3 tools/seed_demo_bulk.py <engine base url> [count=200] [ids.json] [--snapshot]
  users / password come from DEMO_USERS (comma list, default demo.manager,demo.finance,demo.ops,demo.support,demo.user) and DEMO_PASSWORD
  (default demo1234); DEMO_ADMIN=user:password enables the priority / due-date variations (admin-only updates); --snapshot starts by
  snapshotId (installed snapshot on a Workflow Server) instead of branchId. Task ids are read through the starter (a team member cannot
  read an instance it has no task in yet)."""
import sys, os, json, time, random, requests, urllib3
urllib3.disable_warnings()
args = [a for a in sys.argv[1:] if not a.startswith('--')]
H = args[0] if args else sys.exit(__doc__); N = int(args[1]) if len(args) > 1 else 200
IDS = json.load(open(args[2] if len(args) > 2 else os.path.expanduser('~/BAW/tools/hdls_ids.json'))); SNAP = '--snapshot' in sys.argv
USERS = os.environ.get('DEMO_USERS', 'demo.manager,demo.finance,demo.ops,demo.support,demo.user').split(','); PW = os.environ.get('DEMO_PASSWORD', 'demo1234')
ADMIN = tuple(os.environ['DEMO_ADMIN'].split(':', 1)) if os.environ.get('DEMO_ADMIN') else None   # user:password of an administrator - priorities and due dates are admin-only updates (skipped without it)
MGR, FIN, OPS, SUP, USR = USERS[0], USERS[1], USERS[2], USERS[3], USERS[4]
B = H + '/rest/bpm/wle/v1'; random.seed(int(time.time()))
def rest(user, m, path, **kw):
    r = requests.request(m, B + path, auth=(user, PW) if user != 'ADMIN' else ADMIN, verify=False, timeout=120, **kw)
    try: return r.status_code, r.json()
    except Exception: return r.status_code, {}
REF = f"snapshotId={IDS['snapshot']}" if SNAP else f"branchId={IDS['branch']}"
def start(user, proc, params):
    st, j = rest(user, 'POST', f"/process?action=start&bpdId={IDS['bpds'][proc]}&{REF}&parts=all", data={'params': json.dumps(params)})
    if st != 200: print('  start failed', user, proc, st, (j.get('Data') or {}).get('errorMessage', '')[:80]); return None
    return j['data']['piid']
def open_task(user, piid):
    for _ in range(8):
        st, j = rest(user, 'GET', f'/process/{piid}?parts=all'); t = next((x for x in (j.get('data') or {}).get('tasks', []) if x['status'] == 'Received'), None)
        if t: return t['tkiid']
        time.sleep(1)
    return None
def complete(user, tid, params): return rest(user, 'PUT', f'/task/{tid}?action=complete&parts=none', params={'params': json.dumps(params)})[0]
def claim(user, tid): return rest(user, 'PUT', f'/task/{tid}?action=assign&toMe=true&parts=none')[0]
def priority(user, tid, p): return rest('ADMIN', 'PUT', f'/task/{tid}?action=update&priority={p}&parts=none')[0] if ADMIN else 0
def due(user, tid, hours): return rest('ADMIN', 'PUT', f'/task/{tid}?action=update&parts=none', params={'dueDate': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + hours * 3600))})[0] if ADMIN else 0
def icomment(user, piid, text): rest(user, 'POST', f'/process/{piid}?action=comment&parts=none', params={'comment': text})
PEOPLE = ['Alice Martin', 'Bob Keller', 'Carol Diaz', 'Dan Okafor', 'Eva Lindqvist', 'Farid Haddad', 'Grace Chen', 'Hugo Alves', 'Ines Rossi', 'Jonas Weber', 'Kira Novak', 'Liam Byrne', 'Mia Sato', 'Noah Fischer', 'Olga Petrov', 'Pavel Horak', 'Quinn Adler', 'Rosa Marin', 'Sam Iyer', 'Tara Singh']
CATS = ['Travel', 'Meals', 'Hardware', 'Training', 'Software', 'Conference', 'Books', 'Telecom']
PURPOSES = ['Customer visit {city}', 'Team offsite {city}', 'Laptop replacement', 'Certification course', 'Trade fair {city}', 'Client dinner {city}', 'Monitor for home office', 'Online course subscription', 'Taxi to the airport', 'Mobile phone plan', 'Workshop {city}', 'Recruiting event {city}']
CITIES = ['Berlin', 'Lisbon', 'Zurich', 'Madrid', 'Vienna', 'Milan', 'Paris', 'Dublin', 'Oslo', 'Prague', 'Warsaw', 'Athens']
COMPANIES = ['Acme Ltd', 'Globex GmbH', 'Initech SA', 'Umbrella AG', 'Hooli BV', 'Vandelay Industries', 'Stark Trading', 'Wayne Logistics', 'Soylent Foods', 'Tyrell Systems', 'Cyberdyne SL', 'Massive Dynamic', 'Wonka Sweets', 'Oscorp Labs', 'Gringotts Finance', 'Duff Beverages', 'Pied Piper', 'Aperture Optics', 'Bluth Homes', 'Sirius Cybernetics']
PLANS = ['Basic', 'Standard', 'Premium', 'Enterprise']
TICKETS = [('Cannot log in', 'HTTP 401 after the password change', 'High'), ('Report export empty', 'The CSV export contains only the header', 'Medium'), ('Slow dashboard', 'The dashboard takes 30 s to load since Monday', 'Medium'), ('Printer offline', 'The 3rd floor printer shows offline', 'Low'), ('VPN drops', 'The VPN disconnects every 10 minutes', 'High'), ('Wrong invoice total', 'Invoice 2026-118 shows the net amount twice', 'Critical'), ('Email delayed', 'Messages arrive an hour late', 'Medium'), ('Access request', 'Need access to the finance share', 'Low'), ('Mobile app crash', 'The app closes on the task list', 'High'), ('Password expired', 'Cannot change the expired password', 'Medium'), ('Missing attachment', 'Attachments are not shown on tickets', 'Low'), ('Duplicate customer', 'Customer appears twice in the search', 'Medium')]
REQUESTERS = [USR, SUP, FIN, OPS, MGR]
counts = {'expense': 0, 'onboarding': 0, 'ticket': 0}; mix = [('expense', 45), ('onboarding', 25), ('ticket', 30)]
plan = [k for k, w in mix for _ in range(w)]
for i in range(N):
    kind = plan[i % len(plan)]; requester = random.choice(REQUESTERS if i % 3 else [USR])
    if kind == 'expense':
        who = random.choice(PEOPLE); piid = start(requester, 'Expense Approval', {'employee': who, 'amount': round(random.choice([random.uniform(9, 90), random.uniform(90, 900), random.uniform(900, 4500)]), 2), 'category': random.choice(CATS), 'purpose': random.choice(PURPOSES).format(city=random.choice(CITIES)), 'receiptDate': f'2026-0{random.randint(7, 9)}-{random.randint(1, 28):02d}'})
        if not piid: continue
        counts['expense'] += 1; tid = open_task(requester, piid); stage = random.choices(range(6), weights=[30, 15, 20, 20, 10, 5])[0]
        if tid is None: continue
        if stage == 0: priority(MGR, tid, random.choice(['Highest', 'High', 'Normal', 'Normal', 'Low'])); due(MGR, tid, random.choice([-30, -5, 2, 8, 20, 72]))
        elif stage == 1: claim(MGR, tid); priority(MGR, tid, 'High'); icomment(MGR, piid, 'Please check the receipt before approving.')
        elif stage == 2: complete(MGR, tid, {'decision': 'approve', 'comment': 'Approved, within policy.'}); t2 = open_task(requester, piid); t2 and priority(FIN, t2, random.choice(['Normal', 'Low'])); t2 and due(FIN, t2, random.choice([-3, 6, 30]))
        elif stage == 3: complete(MGR, tid, {'decision': 'approve', 'comment': 'OK'}); t2 = open_task(requester, piid); t2 and complete(FIN, t2, {'paymentReference': f'TRX-{random.randint(1000, 9999)}', 'paidOn': f'2026-09-{random.randint(1, 20):02d}'})
        elif stage == 4: complete(MGR, tid, {'decision': 'reject', 'comment': random.choice(['No receipt attached, please resubmit.', 'Exceeds the travel policy limit.', 'Wrong cost centre.'])})
        else: complete(MGR, tid, {'decision': 'approve', 'comment': 'Approved.'}); t2 = open_task(requester, piid); t2 and claim(FIN, t2)
        icomment(requester, piid, f'Submitted for {who}')
    elif kind == 'onboarding':
        co = random.choice(COMPANIES); piid = start(requester, 'Customer Onboarding', {'customerName': co, 'email': 'contact@' + co.split()[0].lower() + '.example', 'plan': random.choice(PLANS)})
        if not piid: continue
        counts['onboarding'] += 1; tid = open_task(requester, piid); stage = random.choices(range(5), weights=[30, 20, 25, 10, 15])[0]
        if tid is None: continue
        if stage == 0: priority(OPS, tid, random.choice(['High', 'Normal', 'Normal'])); due(OPS, tid, random.choice([-8, 4, 24, 48]))
        elif stage == 1: complete(OPS, tid, {'idVerified': True, 'addressVerified': True, 'notes': 'Passport and utility bill checked.'}); t2 = open_task(requester, piid); t2 and due(OPS, t2, random.choice([-2, 12, 40]))
        elif stage == 2: complete(OPS, tid, {'idVerified': True, 'addressVerified': True, 'notes': 'All good.'}); t2 = open_task(requester, piid); t2 and complete(OPS, t2, {'accountNumber': f'ACC-2026-{random.randint(100, 999)}', 'welcomeEmailSent': True})
        elif stage == 3: complete(OPS, tid, {'idVerified': True, 'addressVerified': False, 'notes': random.choice(['Address document expired.', 'Utility bill older than 3 months.'])})
        else: claim(OPS, tid); icomment(OPS, piid, 'Waiting for the signed contract.')
    else:
        title, desc, prio = random.choice(TICKETS); piid = start(requester, 'Support Ticket', {'title': title, 'description': desc, 'priority': prio})
        if not piid: continue
        counts['ticket'] += 1; tid = open_task(requester, piid); stage = random.choices(range(5), weights=[30, 20, 15, 20, 15])[0]
        if tid is None: continue
        if stage == 0: priority(SUP, tid, 'Highest' if prio == 'Critical' else 'High' if prio == 'High' else 'Normal'); due(SUP, tid, random.choice([-1, 3, 6, 24]))
        elif stage == 1: complete(SUP, tid, {'resolution': 'Password reset and account unlocked.', 'rootCause': 'usage', 'timeSpent': random.randint(5, 30)})
        elif stage == 2: complete(SUP, tid, {'resolution': 'Restarted the export service.', 'rootCause': 'infrastructure', 'timeSpent': 40}); t2 = open_task(requester, piid); t2 and complete(requester, t2, {'satisfied': False, 'feedback': 'Still not working after the restart.'})
        elif stage == 3: complete(SUP, tid, {'resolution': 'Configuration corrected.', 'rootCause': 'configuration', 'timeSpent': random.randint(10, 60)}); t2 = open_task(requester, piid); t2 and complete(requester, t2, {'satisfied': True, 'feedback': 'Thanks!'})
        else: claim(SUP, tid); icomment(SUP, piid, 'Escalated to second level.')
    if (i + 1) % 25 == 0: print(f'  {i + 1}/{N}', json.dumps(counts), flush=True)
print(json.dumps(counts), 'instances created')
