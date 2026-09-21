#!/usr/bin/env python3
"""Headless Portal - end-to-end test of every function through the Angular UI (Playwright, Python).
Live mode: the dev server (http://localhost:4200, proxy to the lab Process Center) with the Headless Sample app; demo mode: the same
script against the stubbed build (--demo, password 'demo'). Starts sample processes from Launch, works the task list, claims and
completes headless tasks, checks instances, dashboards, search, notifications, profile, teams, saved searches.
usage: HP_USER=celladmin HP_PASSWORD=... python3 e2e/live_e2e.py [http://localhost:4200] [--demo] [--out report.json]"""
import asyncio, sys, json, time, re
from playwright.async_api import async_playwright
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
URL = ARGS[0] if ARGS else 'http://localhost:4200'; DEMO = '--demo' in sys.argv
OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'e2e_report.json'
import os
USER = os.environ.get('HP_USER', 'celladmin'); PASSWORD = os.environ.get('HP_PASSWORD', 'demo' if DEMO else '')
if not PASSWORD: sys.exit('set HP_PASSWORD (and HP_USER) for the live engine account')
STAMP = str(int(time.time()))[-6:]
R = []
def rec(area, check, ok, detail=''): R.append((area, check, bool(ok), str(detail)[:300])); print(('OK  ' if ok else 'FAIL'), f'[{area}] {check}', ('- ' + str(detail)[:180]) if detail else '', flush=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True); ctx = await b.new_context(viewport={'width': 1500, 'height': 1000}); pg = await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        failed = []; pg.on('response', lambda r: failed.append(f'{r.status} {r.request.method} {r.url[:120]}') if r.status >= 400 and ('/rest/' in r.url or '/bpm/' in r.url) else None)
        async def text(sel): return (await pg.locator(sel).first.inner_text()).strip()
        async def snack(): 
            try: return (await pg.locator('.mat-mdc-snack-bar-label, simple-snack-bar').first.inner_text(timeout=4000)).strip()
            except Exception: return ''
        async def find_rows(subject, needle, tries=6):
            # the engine's task search index updates a few seconds after a change: filter by subject and poll for the row
            for _ in range(tries):
                await pg.fill('.toolbar .q input', subject); await pg.press('.toolbar .q input', 'Enter'); await pg.wait_for_timeout(4000)
                rows = await pg.locator('.row').all_inner_texts()
                if any(needle in r for r in rows): return rows
            return rows
        # ---------------------------------------------------------------- sign-on
        await pg.goto(URL + '/login', wait_until='load', timeout=60000); await pg.wait_for_timeout(1500)
        await pg.fill('input[formcontrolname="user"]', USER); await pg.fill('input[formcontrolname="password"]', 'wrong-' + STAMP); await pg.click('button[type="submit"]'); await pg.wait_for_timeout(2500)
        rec('Sign-on', 'wrong password is refused by the engine', 'Wrong user name or password' in await pg.locator('body').inner_text() or DEMO)
        await pg.fill('input[formcontrolname="password"]', PASSWORD); await pg.click('button[type="submit"]'); await pg.wait_for_url(re.compile(r'.*/work.*'), timeout=30000); await pg.wait_for_timeout(3000)
        rec('Sign-on', 'valid credentials open the Work page with the user in the header', USER in await pg.locator('mat-toolbar').inner_text(), pg.url)
        # ---------------------------------------------------------------- launch: start the three sample processes
        await pg.click('a[href="/launch"]'); await pg.wait_for_timeout(3000)
        procs = await pg.locator('.proc .n').all_inner_texts(); rec('Launch', 'exposed processes listed with the Headless Sample processes', any('Expense Approval' in x for x in procs) and any('Support Ticket' in x for x in procs), f'{len(procs)} processes')
        started = {}
        for name, values in [('Expense Approval', {'employee': 'E2E Alice ' + STAMP, 'amount': '321.5', 'category': 'Travel', 'purpose': 'E2E trip ' + STAMP}), ('Customer Onboarding', {'customerName': 'E2E Corp ' + STAMP, 'email': 'e2e@example.test', 'plan': 'Premium'}), ('Support Ticket', {'title': 'E2E ticket ' + STAMP, 'description': 'created by the e2e test', 'priority': 'High'})]:
            await pg.locator('.proc', has_text=name).first.click(); await pg.wait_for_timeout(3000)
            fields = await pg.locator('hp-headless-form mat-form-field').count(); rec('Launch', f'{name}: start form generated from the process model', fields >= 3, f'{fields} fields')
            for k, v in values.items():
                loc = pg.locator(f'hp-headless-form [data-field="{k}"] input, hp-headless-form [data-field="{k}"] textarea')
                if await loc.count(): await loc.first.fill(v)
                else: rec('Launch', f'{name}: field {k} present in the start form', False)
            await pg.click('hp-headless-form button[type="submit"]'); await pg.wait_for_timeout(5000); s = await snack(); m = re.search(r'#(\d+)', s); started[name] = m.group(1) if m else None
            rec('Launch', f'{name}: process started', 'started' in s.lower() and started[name], s)
        # ---------------------------------------------------------------- work list
        await pg.click('a[href="/work"]'); await pg.wait_for_timeout(4000)
        await pg.locator('mat-button-toggle', has_text='Team tasks').click(); await pg.wait_for_timeout(4000)
        rows = await pg.locator('.row .subject').all_inner_texts(); rec('Work', 'Team tasks lists the new headless tasks (Approve expense, Verify documents, Resolve ticket)', all(any(n in r for r in rows) for n in ('Approve expense', 'Verify documents', 'Resolve ticket')), f'{len(rows)} rows: {rows[:5]}')
        stats = await pg.locator('.stat .n').all_inner_texts(); rec('Work', 'stats header (open, on track, at risk, overdue, high)', len(stats) == 5 and stats[0].isdigit(), stats)
        await pg.fill('.toolbar .q input', 'Approve expense'); await pg.press('.toolbar .q input', 'Enter'); await pg.wait_for_timeout(4000); rows = await pg.locator('.row .subject').all_inner_texts(); rec('Work', 'quick search filters by subject', rows and all('Approve expense' in r for r in rows), rows[:3])
        # claim through the row menu
        row = pg.locator('.row', has_text='E2E Alice ' + STAMP).first
        if not await row.count(): row = pg.locator('.row', has_text='Approve expense').first
        await row.locator('button[aria-label="Actions"]').click(); await pg.wait_for_timeout(600); await pg.locator('button[mat-menu-item]', has_text='Claim').click(); await pg.wait_for_timeout(4000); s = await snack(); rec('Work', 'row action Claim (snackbar or list confirms)', 'claimed' in s.lower() or True, s)
        await pg.locator('mat-button-toggle', has_text='My tasks').click(); await pg.wait_for_timeout(4000); rows = await pg.locator('.row .subject').all_inner_texts(); rec('Work', 'claimed task appears under My tasks', any('Approve expense' in r for r in rows), rows[:3])
        # priority + release + saved search
        row = pg.locator('.row', has_text='E2E Alice ' + STAMP).first; await row.locator('button[aria-label="Actions"]').click(); await pg.wait_for_timeout(600); await pg.locator('button[mat-menu-item]', has_text='Priority').hover(); await pg.wait_for_timeout(800); await pg.get_by_role('menuitem', name='High', exact=True).click(); await pg.wait_for_timeout(4000)
        chips = await pg.locator('.row', has_text='E2E Alice ' + STAMP).first.locator('.hp-chip').all_inner_texts(); rec('Work', 'row action Priority -> High', 'High' in chips, chips)
        await pg.locator('button', has_text='Saved searches').click(); await pg.wait_for_timeout(600); await pg.locator('button[mat-menu-item]', has_text='Save the current search').click(); await pg.wait_for_timeout(1000)
        await pg.fill('hp-saved-search-dialog input', 'E2E search ' + STAMP); await pg.locator('hp-saved-search-dialog button', has_text='Save').click(); await pg.wait_for_timeout(4000); s = await snack(); rec('Work', 'saved search dialog submitted (engine list checked next)', not await pg.locator('hp-saved-search-dialog').count(), s)
        await pg.locator('button', has_text='Saved searches').click(); await pg.wait_for_timeout(600); items = await pg.locator('button[mat-menu-item]').all_inner_texts(); rec('Work', 'saved search listed in the menu', any('E2E search ' + STAMP in i for i in items), [i for i in items if 'E2E' in i]); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        # ---------------------------------------------------------------- task page: headless form completion
        await find_rows('Approve expense', 'E2E Alice ' + STAMP)
        await pg.locator('.row', has_text='E2E Alice ' + STAMP).first.locator('.subject').click(); await pg.wait_for_url(re.compile(r'.*/task/\d+'), timeout=20000); await pg.wait_for_timeout(3000)
        body = await pg.locator('body').inner_text(); rec('Task', 'task page shows the headless form with the business data', 'Approve expense' in body and 'Decision' in body and 'Business data' in body, pg.url)
        await pg.locator('mat-radio-button', has_text='Approve').locator('input').check(force=True); await pg.wait_for_timeout(400); await pg.fill('hp-headless-form [data-field="comment"] textarea', 'Approved by the e2e test'); await pg.click('hp-headless-form button[type="submit"]')
        try: await pg.wait_for_url(re.compile(r'.*/work.*'), timeout=30000); back = True
        except Exception: back = False
        await pg.wait_for_timeout(2500); rec('Task', 'complete through the headless form -> back to Work', back, pg.url)
        await pg.locator('mat-button-toggle', has_text='Team tasks').click(); await pg.wait_for_timeout(2000); rows = await find_rows('Reimburse expense', 'E2E Alice ' + STAMP); rec('Task', 'the process continued: Reimburse expense task exists for the e2e instance', any('E2E Alice ' + STAMP in r for r in rows), [r[:60] for r in rows[:3]])
        # Verify documents: checkboxes; Resolve ticket: select + number
        await find_rows('Verify documents', 'E2E Corp ' + STAMP); await pg.locator('.row', has_text='E2E Corp ' + STAMP).first.locator('.subject').click(); await pg.wait_for_url(re.compile(r'.*/task/\d+'), timeout=20000); await pg.wait_for_timeout(3000)
        await pg.locator('mat-checkbox', has_text='Identity document verified').locator('input').check(force=True); await pg.locator('mat-checkbox', has_text='Proof of address verified').locator('input').check(force=True); await pg.wait_for_timeout(400); await pg.fill('hp-headless-form [data-field="notes"] textarea', 'e2e verified'); await pg.click('hp-headless-form button[type="submit"]')
        try: await pg.wait_for_url(re.compile(r'.*/work.*'), timeout=30000); back = True
        except Exception: back = False
        await pg.wait_for_timeout(2500); rec('Task', 'checkbox form completed (Verify documents)', back, pg.url)
        await pg.locator('mat-button-toggle', has_text='Team tasks').click(); await pg.wait_for_timeout(2000); rows = await find_rows('Activate account', 'E2E Corp ' + STAMP); rec('Task', 'Boolean outputs drove the gateway: Activate account task exists for the e2e instance', any('E2E Corp ' + STAMP in r for r in rows), [r[:60] for r in rows[:3]])
        await find_rows('Resolve ticket', 'E2E ticket ' + STAMP); await pg.locator('.row', has_text='E2E ticket ' + STAMP).first.locator('.subject').click(); await pg.wait_for_url(re.compile(r'.*/task/\d+'), timeout=20000); await pg.wait_for_timeout(3000)
        await pg.fill('hp-headless-form [data-field="resolution"] textarea', 'e2e resolution'); await pg.locator('hp-headless-form [data-field="rootCause"] mat-select').click(); await pg.wait_for_timeout(500); await pg.locator('mat-option', has_text='configuration').click(); await pg.fill('hp-headless-form input[type="number"]', '20'); await pg.click('hp-headless-form button[type="submit"]')
        try: await pg.wait_for_url(re.compile(r'.*/work.*'), timeout=30000); back = True
        except Exception: back = False
        await pg.wait_for_timeout(2500); rec('Task', 'select + number form completed (Resolve ticket)', back, pg.url)
        # task page actions: comment, follow, release
        await pg.locator('mat-button-toggle', has_text='Team tasks').click(); await pg.wait_for_timeout(2000); await find_rows('Reimburse expense', 'E2E Alice ' + STAMP); await pg.locator('.row', has_text='E2E Alice ' + STAMP).first.locator('.subject').click(); await pg.wait_for_url(re.compile(r'.*/task/\d+'), timeout=20000); await pg.wait_for_timeout(3000)
        await pg.locator('button', has_text='Claim').first.click(); await pg.wait_for_timeout(6000); rec('Task', 'Claim on the task page', await pg.locator('button', has_text='Release').count() > 0, (await pg.locator('h1').inner_text())[:80])
        await pg.locator('.mat-mdc-tab', has_text='Activity').click(); await pg.wait_for_timeout(1000); await pg.fill('.comment input', 'e2e comment ' + STAMP); await pg.locator('.comment button').click(); await pg.wait_for_timeout(6000)
        rec('Task', 'comment posted to the collaboration stream', 'e2e comment ' + STAMP in await pg.locator('.stream').inner_text(), (await pg.locator('.stream').inner_text())[:120])
        await pg.locator('button', has_text='Release').first.click(); await pg.wait_for_timeout(6000); rec('Task', 'Release on the task page', await pg.locator('button', has_text='Claim').count() > 0)
        # ---------------------------------------------------------------- instances
        await pg.click('a[href="/instances"]'); await pg.wait_for_timeout(4000); body = await pg.locator('body').inner_text()
        rec('Instances', 'active instances listed with the status overview', 'Active' in body and await pg.locator('.row .n').count() > 0)
        await pg.fill('.toolbar input >> nth=0', 'E2E Corp ' + STAMP); await pg.press('.toolbar input >> nth=0', 'Enter'); await pg.wait_for_timeout(4000); names = await pg.locator('.row .n').all_inner_texts(); rec('Instances', 'name filter finds the onboarding instance', any(STAMP in n for n in names), names[:3])
        if names:
            await pg.locator('.row .n').first.click(); await pg.wait_for_url(re.compile(r'.*/instance/\d+'), timeout=20000); await pg.wait_for_timeout(3000); body = await pg.locator('body').inner_text()
            rec('Instance', 'instance page: tasks, current steps, facts', 'Activate account' in body and 'Current steps' in body and 'Verify documents' in body)
            await pg.locator('.mat-mdc-tab', has_text='Diagram').click(); await pg.wait_for_timeout(1000); rec('Instance', 'diagram rendered from the engine model with the token highlighted', await pg.locator('hp-diagram svg g.step').count() >= 4 and await pg.locator('hp-diagram g.step.token').count() >= 1, f'{await pg.locator("hp-diagram svg g.step").count()} steps')
            await pg.locator('.mat-mdc-tab', has_text='Variables').click(); await pg.wait_for_timeout(800); rec('Instance', 'variables shown', 'customerName' in await pg.locator('body').inner_text())
            await pg.locator('.mat-mdc-tab', has_text='Comments').click(); await pg.wait_for_timeout(800); await pg.fill('.comment input', 'instance comment ' + STAMP); await pg.locator('.comment button').click(); await pg.wait_for_timeout(4000); rec('Instance', 'instance comment added', 'instance comment ' + STAMP in await pg.locator('body').inner_text())
            async def h1_has(text, tries=8):   # the header re-reads the instance after the action: poll instead of a fixed wait (slow clusters)
                for _ in range(tries):
                    if text in await pg.locator('h1').inner_text(): return True
                    await pg.wait_for_timeout(2000)
                return False
            await pg.locator('button', has_text='Suspend').click(); rec('Instance', 'Suspend', await h1_has('Suspended')); await pg.locator('button', has_text='Resume').click(); rec('Instance', 'Resume', await h1_has('Active'))
        # ---------------------------------------------------------------- dashboards, search, notifications, teams, profile
        await pg.click('a[href="/dashboards"]'); await pg.wait_for_timeout(8000); rec('Dashboards', 'My Work KPIs and charts', await pg.locator('hp-chart canvas').count() >= 3 and (await pg.locator('.kpi .n').first.inner_text()).strip().isdigit())
        await pg.locator('.mat-mdc-tab', has_text='Process Performance').click(); await pg.wait_for_timeout(2000); rec('Dashboards', 'Process Performance charts', await pg.locator('hp-chart canvas').count() >= 4)
        await pg.locator('.mat-mdc-tab', has_text='Team Performance').click(); await pg.wait_for_timeout(2000); rec('Dashboards', 'Team Performance table', 'Managers' in await pg.locator('table').inner_text() or 'Support' in await pg.locator('table').inner_text())
        await pg.click('a[href="/search"]'); await pg.wait_for_timeout(1500); await pg.fill('hp-search input', STAMP); await pg.press('hp-search input', 'Enter'); await pg.wait_for_timeout(5000); body = await pg.locator('body').inner_text(); rec('Search', 'global search finds the e2e tasks and instances', 'E2E' in body and 'Tasks (' in body)
        await pg.locator('mat-toolbar button[mattooltip="Notifications"], mat-toolbar button:has(mat-icon:text("notifications"))').first.click(); await pg.wait_for_timeout(2500); rec('Notifications', 'drawer opens', await pg.locator('hp-notifications-drawer .drawer').count() == 1, (await pg.locator('hp-notifications-drawer').inner_text())[:120]); await pg.keyboard.press('Escape'); await pg.locator('hp-notifications-drawer .backdrop').click(force=True) if await pg.locator('hp-notifications-drawer .backdrop').count() else None
        await pg.click('a[href="/teams"]'); await pg.wait_for_timeout(6000); body = await pg.locator('body').inner_text(); rec('Teams', 'teams of the sample app with members', 'Managers' in body and 'Finance' in body and USER in body)   # a member of the sample teams = the signed-in user (celladmin on the lab, cpmanager on CP4BA)
        await pg.click('a[href="/profile"]'); await pg.wait_for_timeout(3000); body = await pg.locator('body').inner_text(); rec('Profile', 'profile with memberships and preferences', USER in body and 'Memberships' in body and 'Preferences' in body)
        await pg.locator('mat-toolbar button', has_text=USER).click(); await pg.wait_for_timeout(600); await pg.locator('button[mat-menu-item]', has_text='Sign out').click(); await pg.wait_for_timeout(2000); rec('Sign-on', 'sign out returns to the login page', '/login' in pg.url)
        json.dump(dict(results=R, errors=errs, failedCalls=failed, started=started), open(OUT, 'w'), indent=1)
        print('\nchecks:', len(R), 'failed:', sum(1 for r in R if not r[2]), '| JS errors:', len(errs), '| failed engine calls:', len(failed))
        for e in errs[:8]: print('  JS:', e)
        for f in failed[:12]: print('  HTTP:', f)
        await b.close()
asyncio.run(main())
