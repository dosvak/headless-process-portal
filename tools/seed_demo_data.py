#!/usr/bin/env python3
"""Populate the Headless Sample app on the engine with realistic instances and tasks in every state, so the portal looks alive:
expenses (fresh, claimed, approved awaiting reimbursement, reimbursed, rejected), onboardings (fresh, awaiting activation,
activated, failed), tickets (fresh, awaiting confirmation, reopened, closed); some tasks claimed by the user, priorities and due
dates varied, comments added. Idempotent enough to rerun (adds another batch).
usage: HP_PASSWORD=... python3 tools/seed_demo_data.py [https://<process-center-host>:9443] [user] [ids.json]"""
import sys, os, json, time, random, requests, urllib3
urllib3.disable_warnings()
H = sys.argv[1] if len(sys.argv) > 1 else 'https://<process-center-host>:9443'; USER = sys.argv[2] if len(sys.argv) > 2 else 'celladmin'; PW = os.environ.get('HP_PASSWORD') or sys.exit('set HP_PASSWORD')
IDS = json.load(open(sys.argv[3] if len(sys.argv) > 3 else os.path.expanduser('~/BAW/tools/hdls_ids.json'))); A = (USER, PW); B = H + '/rest/bpm/wle/v1'
random.seed(int(time.time()))
def rest(m, path, **kw):
    r = requests.request(m, B + path, auth=A, verify=False, timeout=120, **kw)
    try: return r.status_code, r.json()
    except Exception: return r.status_code, {}
def start(proc, params):
    st, j = rest('POST', f"/process?action=start&bpdId={IDS['bpds'][proc]}&branchId={IDS['branch']}&parts=all", data={'params': json.dumps(params)})
    if st != 200: print('  start failed', proc, st, (j.get('Data') or {}).get('errorMessage')); return None, None
    d = j['data']; t = next((x for x in d['tasks'] if x['status'] == 'Received'), None); return d['piid'], (t['tkiid'] if t else None)
def open_task(piid):
    for _ in range(10):
        st, j = rest('GET', f'/process/{piid}?parts=all'); t = next((x for x in (j.get('data') or {}).get('tasks', []) if x['status'] == 'Received'), None)
        if t: return t['tkiid']
        time.sleep(1)
    return None
def complete(tid, params): return rest('PUT', f'/task/{tid}?action=complete&parts=none', params={'params': json.dumps(params)})[0]
def claim(tid): return rest('PUT', f'/task/{tid}?action=assign&toMe=true&parts=none')[0]
def priority(tid, p): return rest('PUT', f'/task/{tid}?action=update&priority={p}&parts=none')[0]
def due(tid, hours): return rest('PUT', f'/task/{tid}?action=update&parts=none', params={'dueDate': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + hours * 3600))})[0]
def comment(tid, text): rest('POST', f'/social/task/{tid}/comment', params={'message': text})
def icomment(piid, text): rest('POST', f'/process/{piid}?action=comment&parts=none', params={'comment': text})

PEOPLE = ['Alice Martin', 'Bob Keller', 'Carol Diaz', 'Dan Okafor', 'Eva Lindqvist', 'Farid Haddad', 'Grace Chen', 'Hugo Alves', 'Ines Rossi', 'Jonas Weber']
CATS = ['Travel', 'Meals', 'Hardware', 'Training', 'Software', 'Conference']
PURPOSES = ['Customer visit {city}', 'Team offsite {city}', 'Laptop replacement', 'Certification course', 'Trade fair {city}', 'Client dinner {city}', 'Monitor for home office', 'Online course subscription']
CITIES = ['Berlin', 'Lisbon', 'Zurich', 'Madrid', 'Vienna', 'Milan', 'Paris', 'Dublin']
COMPANIES = ['Acme Ltd', 'Globex GmbH', 'Initech SA', 'Umbrella AG', 'Hooli BV', 'Vandelay Industries', 'Stark Trading', 'Wayne Logistics', 'Soylent Foods', 'Tyrell Systems']
PLANS = ['Basic', 'Standard', 'Premium', 'Enterprise']
TICKETS = [('Cannot log in', 'HTTP 401 after the password change', 'High'), ('Report export empty', 'The CSV export contains only the header', 'Medium'), ('Slow dashboard', 'The dashboard takes 30 s to load since Monday', 'Medium'), ('Wrong VAT on invoice', 'Invoice 2026-0912 shows 19% instead of 7%', 'High'), ('Mobile app crash', 'The app closes when opening the task list', 'Critical'), ('Feature request: dark mode', 'Please add a dark theme to the portal', 'Low'), ('E-mail notifications missing', 'No e-mail since the last upgrade', 'Medium'), ('Two-factor code not received', 'SMS codes arrive 10 minutes late', 'High')]
made = {'expense': [], 'onboarding': [], 'ticket': []}
print('Expense Approval ...')
for i in range(9):
    who = random.choice(PEOPLE); params = {'employee': who, 'amount': round(random.uniform(18, 2400), 2), 'category': random.choice(CATS), 'purpose': random.choice(PURPOSES).format(city=random.choice(CITIES)), 'receiptDate': f'2026-09-{random.randint(1, 9):02d}'}
    piid, tid = start('Expense Approval', params); 
    if not piid: continue
    made['expense'].append(piid); stage = i % 5
    if stage == 1: claim(tid); priority(tid, 'High'); comment(tid, 'Please check the receipt before approving.')
    elif stage == 2: complete(tid, {'decision': 'approve', 'comment': 'Approved, within policy.'}); t2 = open_task(piid); t2 and priority(t2, random.choice(['Normal', 'Low'])); t2 and due(t2, random.choice([-3, 6, 30]))
    elif stage == 3: complete(tid, {'decision': 'approve', 'comment': 'OK'}); t2 = open_task(piid); t2 and complete(t2, {'paymentReference': f'TRX-{random.randint(1000, 9999)}', 'paidOn': '2026-09-10'})
    elif stage == 4: complete(tid, {'decision': 'reject', 'comment': 'No receipt attached, please resubmit.'})
    else: priority(tid, random.choice(['Highest', 'High', 'Normal'])); due(tid, random.choice([-5, 2, 8, 20]))
    icomment(piid, f'Submitted by {who}')
print('Customer Onboarding ...')
for i in range(7):
    co = random.choice(COMPANIES); params = {'customerName': co, 'email': 'contact@' + co.split()[0].lower() + '.example', 'plan': random.choice(PLANS)}
    piid, tid = start('Customer Onboarding', params)
    if not piid: continue
    made['onboarding'].append(piid); stage = i % 4
    if stage == 1: complete(tid, {'idVerified': True, 'addressVerified': True, 'notes': 'Passport and utility bill checked.'}); t2 = open_task(piid); t2 and due(t2, random.choice([-2, 12, 40]))
    elif stage == 2: complete(tid, {'idVerified': True, 'addressVerified': True, 'notes': 'All good.'}); t2 = open_task(piid); t2 and complete(t2, {'accountNumber': f'ACC-2026-{random.randint(100, 999)}', 'welcomeEmailSent': True})
    elif stage == 3: complete(tid, {'idVerified': True, 'addressVerified': False, 'notes': 'Address document expired.'})
    else: claim(tid) if i % 2 else priority(tid, 'High')
print('Support Ticket ...')
for i, (title, desc, prio) in enumerate(TICKETS):
    piid, tid = start('Support Ticket', {'title': title, 'description': desc, 'priority': prio})
    if not piid: continue
    made['ticket'].append(piid); stage = i % 4
    if stage == 1: complete(tid, {'resolution': 'Password reset and account unlocked.', 'rootCause': 'usage', 'timeSpent': 15})
    elif stage == 2: complete(tid, {'resolution': 'Restarted the export service.', 'rootCause': 'infrastructure', 'timeSpent': 40}); t2 = open_task(piid); t2 and complete(t2, {'satisfied': False, 'feedback': 'Still empty after the restart.'})
    elif stage == 3: complete(tid, {'resolution': 'Configuration corrected.', 'rootCause': 'configuration', 'timeSpent': 25}); t2 = open_task(piid); t2 and complete(t2, {'satisfied': True, 'feedback': 'Thanks!'})
    else: priority(tid, 'Highest' if prio == 'Critical' else 'High' if prio == 'High' else 'Normal'); due(tid, random.choice([-1, 3, 6])); comment(tid, 'Escalated by the service desk.')
print(json.dumps({k: len(v) for k, v in made.items()}), 'instances created')
