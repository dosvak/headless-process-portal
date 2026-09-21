import { BpmApi } from './bpm-api';
import { CurrentUser, DiagramStep, ExposedProcess, FormField, GroupSummary, HeadlessForm, InstanceDetails, InstanceFilter, InstanceRow, InstanceSearchResult, Priority, ProcessModel, SavedSearch, StatusOverview, StreamItem, TaskDetails, TaskFilter, TaskRow, TaskSearchResult, TaskStats, TeamInfo, UserSummary } from './models';

type Json = Record<string, any>;
interface Fixtures { currentUser: Json; users: Json[]; groups: Json[]; exposed: Json[]; models: Record<string, Json>; taskRows: Json[]; tasks: Record<string, Json>; instanceRows: Json[]; instances: Record<string, Json>; overview: Json; savedSearches: Json[]; streams: { task: Record<string, Json[]>; instance: Record<string, Json[]> }; }
interface StepDef { name: string; team: string; priority: Priority; dueHours: number; form: (v: Json) => HeadlessForm; outputs: string[]; }
interface ProcDef { name: string; inputs: { name: string; type: string }[]; teams: string[]; instanceName: (v: Json) => string; collect: (v: Json) => Json; steps: StepDef[]; next: (stepIndex: number, v: Json) => number | string; }
const DEMO_PEOPLE: { userName: string; fullName: string; email: string; teams: string[] }[] = [
  { userName: 'alice', fullName: 'Alice Martin', email: 'alice@example.test', teams: ['Managers', 'Finance'] }, { userName: 'bob', fullName: 'Bob Keller', email: 'bob@example.test', teams: ['Operations', 'Support'] }, { userName: 'carol', fullName: 'Carol Diaz', email: 'carol@example.test', teams: ['Support', 'Managers'] }];
const f = (name: string, label: string, type: FormField['type'], required: boolean, options = '', value = '', help = ''): FormField => ({ name, label, type, required, options, value, help });
/** The sample processes of the Headless Sample app, mirrored from tools/build_headless_sample.py so the demo continues a process the way the engine does. */
const PROCESSES: ProcDef[] = [
  { name: 'Expense Approval', inputs: [{ name: 'employee', type: 'String' }, { name: 'amount', type: 'Decimal' }, { name: 'category', type: 'String' }, { name: 'purpose', type: 'String' }, { name: 'receiptDate', type: 'String' }], teams: ['Managers', 'Finance'],
    instanceName: v => `Expense ${v['employee']} ${v['amount']} EUR`, collect: v => ({ request: { employee: v['employee'], amount: Number(v['amount']) || 0, category: v['category'], purpose: v['purpose'], receiptDate: v['receiptDate'] } }),
    steps: [{ name: 'Approve expense', team: 'Managers', priority: 'High', dueHours: 8, outputs: ['decision', 'comment'], form: v => ({ title: 'Approve expense', description: `Expense of ${v['request'].employee} for ${v['request'].purpose} (${v['request'].category}): ${v['request'].amount} EUR`, fields: [f('decision', 'Decision', 'radio', true, 'approve:Approve|reject:Reject', '', 'Approve or reject the expense'), f('comment', 'Comment', 'textarea', false, '', '', 'Visible to the employee')] }) },
      { name: 'Reimburse expense', team: 'Finance', priority: 'Normal', dueHours: 24, outputs: ['paymentReference', 'paidOn'], form: v => ({ title: 'Reimburse expense', description: `Approved expense of ${v['request'].employee}: ${v['request'].amount} EUR - ${v['comment'] ?? ''}`, fields: [f('paymentReference', 'Payment reference', 'text', true, '', '', 'Reference of the bank transfer'), f('paidOn', 'Paid on', 'date', true, '', '', 'Value date of the payment')] }) }],
    next: (i, v) => i === 0 ? (v['decision'] === 'approve' ? 1 : 'Rejected') : 'Reimbursed' },
  { name: 'Customer Onboarding', inputs: [{ name: 'customerName', type: 'String' }, { name: 'email', type: 'String' }, { name: 'plan', type: 'String' }], teams: ['Operations'],
    instanceName: v => `Onboarding ${v['customerName']}`, collect: v => ({ request: { customerName: v['customerName'], email: v['email'], plan: v['plan'] } }),
    steps: [{ name: 'Verify documents', team: 'Operations', priority: 'Normal', dueHours: 4, outputs: ['idVerified', 'addressVerified', 'notes'], form: v => ({ title: 'Verify documents', description: `New customer ${v['request'].customerName} (${v['request'].email}), plan ${v['request'].plan}`, fields: [f('idVerified', 'Identity document verified', 'checkbox', false, '', 'false'), f('addressVerified', 'Proof of address verified', 'checkbox', false, '', 'false'), f('notes', 'Notes', 'textarea', false, '', '', 'Findings of the verification')] }) },
      { name: 'Activate account', team: 'Operations', priority: 'Low', dueHours: 24, outputs: ['accountNumber', 'welcomeEmailSent'], form: v => ({ title: 'Activate account', description: `Verified customer ${v['request'].customerName} - ${v['notes'] ?? ''}`, fields: [f('accountNumber', 'Account number', 'text', true, '', '', 'Number of the activated account'), f('welcomeEmailSent', 'Welcome e-mail sent', 'checkbox', false, '', 'false')] }) }],
    next: (i, v) => i === 0 ? (v['idVerified'] === true && v['addressVerified'] === true ? 1 : 'Verification failed') : 'Activated' },
  { name: 'Support Ticket', inputs: [{ name: 'title', type: 'String' }, { name: 'description', type: 'String' }, { name: 'priority', type: 'String' }], teams: ['Support', 'Requesters'],
    instanceName: v => `Ticket ${v['title']}`, collect: v => ({ request: { title: v['title'], description: v['description'], priority: v['priority'] }, resolution: '' }),
    steps: [{ name: 'Resolve ticket', team: 'Support', priority: 'High', dueHours: 4, outputs: ['resolution', 'rootCause', 'timeSpent'], form: v => ({ title: 'Resolve ticket', description: `[${v['request'].priority}] ${v['request'].title}: ${v['request'].description}`, fields: [f('resolution', 'Resolution', 'textarea', true, '', v['resolution'] ?? '', 'What was done'), f('rootCause', 'Root cause', 'select', true, 'configuration|defect|usage|infrastructure|unknown'), f('timeSpent', 'Time spent (minutes)', 'number', true, '', '30')] }) },
      { name: 'Confirm resolution', team: 'Requesters', priority: 'Normal', dueHours: 48, outputs: ['satisfied', 'feedback'], form: v => ({ title: 'Confirm resolution', description: `Ticket ${v['request'].title} resolved: ${v['resolution']} (root cause ${v['rootCause']})`, fields: [f('satisfied', 'Resolution accepted', 'radio', true, 'true:Yes, close the ticket|false:No, reopen', 'true'), f('feedback', 'Feedback', 'textarea', false, '', '', 'Optional feedback for the support team')] }) }],
    next: (i, v) => i === 0 ? 1 : (v['satisfied'] === true ? 'Closed' : 0) },
];
const PRIO_NUM: Record<string, number> = { Highest: 10, High: 20, Normal: 30, Low: 40, Lowest: 50 };
const OPEN = new Set(['Received', 'Replied', 'Forwarded', 'Sent', 'New', 'Special']);
const now = () => new Date().toISOString();
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

/** In-memory engine of the demo mode: fixtures captured from the lab (public/fixtures/engine.json) plus the sample processes'
 *  behaviour (start, complete -> gateway -> next task) and every task / instance action of the portal. State lives for the tab. */
export class StubEngine implements Omit<BpmApi, 'mode'> {
  private fx: Fixtures | null = null; private ready: Promise<void>;
  private user = 'celladmin'; private tasks = new Map<string, Json>(); private instances = new Map<string, Json>(); private seq = 900000;
  private follows = new Set<string>(); private streams = new Map<string, StreamItem[]>(); private searches: SavedSearch[] = []; private avatars = new Map<string, string>();
  private userList: UserSummary[] = []; private groupList: GroupSummary[] = []; private prefs: Json = {};
  constructor() { this.ready = this.load(); }
  setUser(name: string) { this.user = name; }
  private async load() {
    const r = await fetch('/fixtures/engine.json'); this.fx = await r.json() as Fixtures;
    for (const [id, t] of Object.entries(this.fx.tasks)) this.tasks.set(id, clone(t));
    for (const [id, i] of Object.entries(this.fx.instances)) this.instances.set(id, clone(i));
    this.userList = [...this.fx.users.map(u => ({ userID: u['userID'], userName: u['userName'], fullName: u['fullName'] || u['userName'], emailAddress: u['emailAddress'] ?? null })), ...DEMO_PEOPLE.map((p, i) => ({ userID: 1000 + i, userName: p.userName, fullName: p.fullName, emailAddress: p.email }))];
    this.groupList = this.fx.groups.filter(g => !g['deleted']).map(g => ({ groupID: g['groupID'], groupName: g['groupName'], displayName: g['displayName'] || g['groupName'], description: g['description'] ?? '', members: [...(g['members'] ?? [])] }));
    for (const p of DEMO_PEOPLE) for (const g of this.groupList) { const team = this.teamName(g.groupName); if (p.teams.includes(team) || team === 'All Users' || team === 'Requesters') if (!g.members.includes(p.userName)) g.members.push(p.userName); }
    this.searches = (this.fx.savedSearches ?? []).map(d => ({ id: String(d['id']), name: d['name'], shared: !!d['shared'], definition: d, filter: { scope: 'all' } } as SavedSearch));
    for (const [k, v] of Object.entries(this.fx.streams?.task ?? {})) this.streams.set('t' + k, v as StreamItem[]);
    for (const [k, v] of Object.entries(this.fx.streams?.instance ?? {})) this.streams.set('i' + k, v as StreamItem[]);
  }
  private teamName(group: string) { const m = /^(.+?)_[TS]_[0-9a-f-]+/.exec(group); return m ? m[1] : group; }
  private groupOf(team: string) { return this.groupList.find(g => g.groupName.includes('_T_') && this.teamName(g.groupName) === team)?.groupName ?? this.groupList.find(g => this.teamName(g.groupName) === team)?.groupName ?? team; }
  private myGroups() { return new Set(this.groupList.filter(g => g.members.includes(this.user)).map(g => g.groupName)); }
  private myTeams() { return new Set([...this.myGroups()].map(g => this.teamName(g))); }
  private refuse(code: string, msg: string): never { throw { status: 403, error: { Data: { errorNumber: code, errorMessage: `${code}: ${msg}` } } }; }
  private notFound(what: string): never { throw { status: 404, error: { Data: { errorNumber: 'CWTBG0047E', errorMessage: `CWTBG0047E: ${what} does not exist.` } } }; }

  // ---------------------------------------------------------------- users
  async currentUser(): Promise<CurrentUser> {
    await this.ready; const u = this.userList.find(x => x.userName === this.user); if (!u) throw { status: 401, error: { Data: { errorMessage: 'Unknown demo user' } } };
    const memberships = this.groupList.filter(g => g.members.includes(this.user)).map(g => g.groupName);
    return { userID: u.userID, userName: u.userName, fullName: u.fullName, emailAddress: u.emailAddress, memberships, userPreferences: { 'Task E-mail Notification': 'true', ...this.prefs }, editableUserPreferences: ['Task E-mail Notification', 'Alert On Assign And Run', 'Portal Language', 'Time Zone'] };
  }
  async users(filter = '*') { await this.ready; const rx = new RegExp('^' + filter.replace(/\*/g, '.*'), 'i'); return this.userList.filter(u => rx.test(u.userName) || rx.test(u.fullName)); }
  async groups(filter = '*') { await this.ready; const rx = new RegExp('^' + filter.replace(/\*/g, '.*'), 'i'); return this.groupList.filter(g => rx.test(g.displayName) || rx.test(g.groupName)); }
  async teams(): Promise<TeamInfo[]> { await this.ready; const by = new Map<string, TeamInfo>(); for (const g of this.groupList) { const n = this.teamName(g.groupName); const t = by.get(n) ?? { name: g.groupName, displayName: n, members: [], description: g.description }; for (const m of g.members) if (!t.members.includes(m)) t.members.push(m); by.set(n, t); } return [...by.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)); }
  async avatar(user?: string) { await this.ready; return this.avatars.get(user ?? this.user) ?? null; }
  async setAvatar(dataUrl: string | null) { dataUrl ? this.avatars.set(this.user, dataUrl) : this.avatars.delete(this.user); }
  async setPreferences(prefs: Record<string, string>) { Object.assign(this.prefs, prefs); }

  // ---------------------------------------------------------------- tasks
  private row(t: Json): TaskRow {
    const i = this.instances.get(String(t['piid']));
    return { taskId: Number(t['tkiid']), subject: t['displayName'] || t['name'], status: t['status'], priority: t['priorityName'] ?? 'Normal', dueDate: t['dueTime'] ?? null, assignedTo: t['assignedTo'] ?? null, assignedType: t['assignedToType'] ?? null, instanceId: Number(t['piid']), instanceName: t['processInstanceName'] ?? i?.['name'] ?? '', processName: i?.['processTemplateName'] ?? '', appAcronym: i?.['processAppAcronym'] ?? 'HDLS', instanceStatus: i?.['executionState'] ?? '', instanceDueDate: i?.['dueDate'] ?? null, created: t['activationTime'] ?? null, isAtRisk: !!t['isAtRisk'] };
  }
  private visible(t: Json) { const g = this.myGroups(); return (t['assignedToType'] === 'User' && t['assignedTo'] === this.user) || (t['assignedToType'] === 'Group' && g.has(t['assignedTo'])) || t['originator'] === this.user || t['owner'] === this.user; }
  async searchTasks(fl: TaskFilter): Promise<TaskSearchResult> {
    await this.ready; let list = [...this.tasks.values()];
    if (fl.scope === 'closed') list = list.filter(t => t['status'] === 'Closed'); else if (fl.statuses?.length) list = list.filter(t => fl.statuses!.includes(t['status'])); else list = list.filter(t => OPEN.has(t['status']));
    if (fl.scope === 'mine') list = list.filter(t => t['assignedToType'] === 'User' && t['assignedTo'] === this.user);
    if (fl.scope === 'team') { const g = this.myGroups(); list = list.filter(t => t['assignedToType'] === 'Group' && g.has(t['assignedTo'])); }
    if (fl.scope === 'closed') list = list.filter(t => this.visible(t));
    if (fl.user) list = list.filter(t => t['assignedTo'] === fl.user);
    if (fl.text) list = list.filter(t => String(t['displayName'] || t['name']).toLowerCase().includes(fl.text!.toLowerCase()));
    if (fl.process) list = list.filter(t => this.instances.get(String(t['piid']))?.['processTemplateName'] === fl.process);
    if (fl.app) list = list.filter(t => (this.instances.get(String(t['piid']))?.['processAppAcronym'] ?? 'HDLS') === fl.app);
    if (fl.priorities?.length) list = list.filter(t => fl.priorities!.includes(t['priorityName']));
    const n = Date.now(); if (fl.due === 'overdue') list = list.filter(t => t['dueTime'] && new Date(t['dueTime']).getTime() < n);
    if (fl.due === 'today') { const d = new Date().toDateString(); list = list.filter(t => t['dueTime'] && new Date(t['dueTime']).toDateString() === d); }
    if (fl.due === 'week') list = list.filter(t => t['dueTime'] && new Date(t['dueTime']).getTime() - n < 7 * 86400000);
    let rows = list.map(t => this.row(t));
    const key = { taskDueDate: (r: TaskRow) => r.dueDate ?? '9', taskPriority: (r: TaskRow) => PRIO_NUM[r.priority] ?? 30, taskReceivedDate: (r: TaskRow) => r.created ?? '', taskSubject: (r: TaskRow) => r.subject, instanceName: (r: TaskRow) => r.instanceName, taskClosedDate: (r: TaskRow) => this.tasks.get(String(r.taskId))?.['completionTime'] ?? '' }[fl.sort ?? 'taskDueDate'] ?? ((r: TaskRow) => r.dueDate ?? '9');
    rows.sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; }); if (fl.sortDir === 'desc') rows.reverse();
    const offset = fl.offset ?? 0, size = fl.size ?? 25; return { rows: rows.slice(offset, offset + size), totalCount: rows.length, offset, size };
  }
  async taskStats(scope: TaskFilter['scope']): Promise<TaskStats> { const r = await this.searchTasks({ scope, size: 5000 }); const n = Date.now(); const s: TaskStats = { total: r.totalCount, onTrack: 0, atRisk: 0, overdue: 0, byPriority: {}, byStatus: {} }; for (const t of r.rows) { if (t.dueDate && new Date(t.dueDate).getTime() < n) s.overdue++; else if (t.isAtRisk) s.atRisk++; else s.onTrack++; s.byPriority[t.priority] = (s.byPriority[t.priority] ?? 0) + 1; s.byStatus[t.status] = (s.byStatus[t.status] ?? 0) + 1; } return s; }
  async task(id: string): Promise<TaskDetails> { await this.ready; const t = this.tasks.get(id); if (!t) this.notFound(`Task '${id}'`); return clone(t) as TaskDetails; }
  async taskActions(ids: string[]) { await this.ready; const out: Record<string, string[]> = {}; for (const id of ids) out[id] = ['ACTION_CLAIM', 'ACTION_COMPLETE', 'ACTION_REASSIGN', 'ACTION_CANCEL']; return out; }
  private open(id: string) { const t = this.tasks.get(id); if (!t) this.notFound(`Task '${id}'`); if (t['status'] === 'Closed') this.refuse('CWTBG0550E', `Task ${id} is already closed.`); return t; }
  async claim(id: string) { await this.ready; const t = this.open(id); if (t['assignedToType'] === 'Group' && !this.myGroups().has(t['assignedTo'])) this.refuse('CWTBG0548E', `You are not a member of the team of task ${id}.`); t['assignedToType'] = 'User'; t['assignedTo'] = this.user; t['assignedToDisplayName'] = this.user; t['owner'] = this.user; t['status'] = 'Received'; this.log('t' + id, `claimed task ${t['displayName']}`); }
  async release(id: string) { await this.ready; const t = this.open(id); t['assignedToType'] = 'Group'; t['assignedTo'] = t['_team'] ?? this.groupOf(t['teamDisplayName'] ?? 'All Users'); t['assignedToDisplayName'] = t['teamDisplayName']; t['owner'] = null; this.log('t' + id, `released task ${t['displayName']} to ${t['teamDisplayName']}`); }
  async assign(id: string, target: { user?: string; group?: string }) { await this.ready; const t = this.open(id); if (target.user) { if (!this.userList.some(u => u.userName === target.user)) this.refuse('CWTBG0028E', `User '${target.user}' does not exist.`); t['assignedToType'] = 'User'; t['assignedTo'] = target.user; t['assignedToDisplayName'] = target.user; } else { t['assignedToType'] = 'Group'; t['assignedTo'] = target.group; t['assignedToDisplayName'] = this.teamName(target.group ?? ''); } this.log('t' + id, `assigned task to ${target.user ?? this.teamName(target.group ?? '')}`); }
  async bulkClaim(ids: string[]) { for (const id of ids) await this.claim(id); }
  async bulkCancel(ids: string[]) { for (const id of ids) await this.cancelTask(id); }
  async setPriority(id: string, priority: string) { await this.ready; const t = this.open(id); t['priorityName'] = priority; t['priority'] = PRIO_NUM[priority] ?? 30; this.log('t' + id, `set the priority to ${priority}`); }
  async setDueDate(id: string, iso: string) { await this.ready; const t = this.open(id); t['dueTime'] = iso; this.log('t' + id, `changed the due date`); }
  async saveTaskData(id: string, params: Record<string, unknown>) { await this.ready; const t = this.open(id); Object.assign(t['data']['variables'], params); }
  async cancelTask(id: string) { await this.ready; const t = this.open(id); t['status'] = 'Closed'; t['state'] = 'STATE_CANCELED'; t['completionTime'] = now(); this.log('t' + id, `cancelled task ${t['displayName']}`); }
  async complete(id: string, params: Record<string, unknown>) {
    await this.ready; const t = this.open(id); const inst = this.instances.get(String(t['piid']));
    if (t['assignedToType'] === 'Group') { if (!this.myGroups().has(t['assignedTo'])) this.refuse('CWTBG0548E', `You are not a member of the team of task ${id}.`); t['assignedToType'] = 'User'; t['assignedTo'] = this.user; }
    else if (t['assignedTo'] !== this.user) this.refuse('CWTBG0553E', `Task ${id} is assigned to ${t['assignedTo']}.`);
    Object.assign(t['data']['variables'], params); t['status'] = 'Closed'; t['state'] = 'STATE_FINISHED'; t['completionTime'] = now(); t['closeByUser'] = this.user; t['closeByUserFullName'] = this.user; t['owner'] = this.user;
    this.log('t' + id, `completed task ${t['displayName']}`); this.log('i' + t['piid'], `${this.user} completed ${t['displayName']}`);
    if (inst && inst['_sim']) { const sim = inst['_sim'] as { proc: number; step: number; vars: Json }; Object.assign(sim.vars, params); inst['variables'] = { ...sim.vars }; this.advance(inst, PROCESSES[sim.proc].next(sim.step, sim.vars)); }
    else if (inst) { inst['lastModificationTime'] = now(); if (!inst['tasks'].some((x: Json) => OPEN.has(x['status']))) { inst['executionState'] = 'Completed'; inst['state'] = 'STATE_FINISHED'; } }
  }
  private log(key: string, what: string) { const list = this.streams.get(key) ?? []; list.unshift({ verb: 'POST', published: now(), actor: { displayName: this.user, id: this.user }, content: what }); this.streams.set(key, list); }
  async taskStream(id: string) { await this.ready; return this.streams.get('t' + id) ?? []; }
  async commentTask(id: string, text: string) { await this.ready; this.log('t' + id, text); }
  async followTask(id: string, follow: boolean) { follow ? this.follows.add('t' + id) : this.follows.delete('t' + id); }
  async isFollowingTask(id: string) { return this.follows.has('t' + id); }

  // ---------------------------------------------------------------- launch and the process simulation
  async exposedProcesses(): Promise<ExposedProcess[]> { await this.ready; return clone(this.fx!.exposed) as ExposedProcess[]; }
  async processModel(bpdId: string, snapshotId: string): Promise<ProcessModel> { await this.ready; const d = this.fx!.models[bpdId]; if (!d) this.notFound(`Process '${bpdId}'`); const inputs = Object.entries(d['DataModel']?.['inputs'] ?? {}).map(([name, v]: [string, any]) => ({ name, type: v['type'] ?? 'String', isList: !!v['isList'], classId: v['classId'] ?? '' })); return { name: d['Header']?.['name'] ?? '', description: d['Header']?.['description'] ?? '', inputs, steps: (d['Diagram']?.['step'] ?? []) as DiagramStep[] }; }
  async startProcess(bpdId: string, snapshotId: string, params: Record<string, unknown>) {
    await this.ready; const ex = this.fx!.exposed.find(e => e['itemID'] === bpdId); if (!ex) this.notFound(`Process '${bpdId}'`);
    const pi = PROCESSES.findIndex(p => p.name === ex['display']); const proc = PROCESSES[pi]; const piid = String(++this.seq); const vars: Json = { ...params, ...(proc ? proc.collect(params) : {}) };
    const model = this.fx!.models[bpdId]; const inst: Json = { piid, name: proc ? proc.instanceName(params) : `${ex['display']}:${piid}`, description: '', executionState: 'Active', state: 'STATE_RUNNING', creationTime: now(), lastModificationTime: now(), dueDate: new Date(Date.now() + 8 * 3600000).toISOString(), processTemplateName: ex['display'], processTemplateID: bpdId, processAppName: ex['processAppName'], processAppAcronym: ex['processAppAcronym'], processAppID: ex['processAppID'], snapshotName: ex['snapshotName'], snapshotID: ex['snapshotID'], branchID: ex['branchID'], tasks: [], variables: { ...vars }, comments: [], diagram: model?.['Diagram']?.['step'] ?? [], executionTree: { root: { name: ex['display'], children: [] } }, _sim: proc ? { proc: pi, step: -1, vars } : null, _actions: { standardActions: ['ACTION_SUSPEND_INSTANCE', 'ACTION_ABORT_INSTANCE'] } };
    this.instances.set(piid, inst); this.log('i' + piid, `${this.user} started ${inst['name']}`);
    if (proc) this.advance(inst, 0); else { inst['executionState'] = 'Completed'; inst['state'] = 'STATE_FINISHED'; }
    const first = inst['tasks'].find((t: Json) => OPEN.has(t['status']));
    return { piid, name: inst['name'], firstTaskId: first ? String(first['tkiid']) : undefined };
  }
  /** Moves a simulated instance to a step (creates its task with the form contract) or to an end event. */
  private advance(inst: Json, target: number | string) {
    const sim = inst['_sim'] as { proc: number; step: number; vars: Json }; const proc = PROCESSES[sim.proc]; inst['lastModificationTime'] = now();
    if (typeof target === 'string') { inst['executionState'] = 'Completed'; inst['state'] = 'STATE_FINISHED'; inst['executionTree'] = { root: { name: proc.name, children: [] } }; this.log('i' + inst['piid'], `instance finished at ${target}`); return; }
    const step = proc.steps[target]; sim.step = target; const form = step.form(sim.vars); sim.vars['form'] = form;
    const tid = String(++this.seq); const group = this.groupOf(step.team); const stepId = (inst['diagram'] as Json[]).find(s => s['name'] === step.name)?.['ID'] ?? step.name;
    const task: Json = { tkiid: tid, name: step.name, displayName: step.name, description: step.name, status: 'Received', state: 'STATE_READY', priority: PRIO_NUM[step.priority], priorityName: step.priority, dueTime: new Date(Date.now() + step.dueHours * 3600000).toISOString(), atRiskTime: new Date(Date.now() + step.dueHours * 3600000 * 0.9).toISOString(), isAtRisk: false, activationTime: now(), startTime: null, completionTime: null, lastModificationTime: now(), originator: this.user, owner: null, assignedTo: group, assignedToDisplayName: step.team, assignedToType: 'Group', piid: inst['piid'], processInstanceName: inst['name'], teamDisplayName: step.team, teamName: group, teamID: null, managerTeamDisplayName: 'Managers of All Users', data: { variables: { form, request: sim.vars['request'], ...Object.fromEntries(step.outputs.map(o => [o, sim.vars[o] ?? null])) } }, actions: null, serviceType: 'COACHFLOW', kind: 'KIND_PARTICIPATING', _team: group };
    this.tasks.set(tid, task); inst['tasks'].push(task); inst['executionTree'] = { root: { name: proc.name, children: [{ name: step.name, tokenId: String(target + 2), flowObjectId: stepId, createdTaskIDs: [tid] }] } };
    this.log('i' + inst['piid'], `task ${step.name} created for ${step.team}`);
  }

  // ---------------------------------------------------------------- instances
  private irow(i: Json): InstanceRow { return { instanceId: Number(i['piid']), name: i['name'], processName: i['processTemplateName'], appAcronym: i['processAppAcronym'], status: i['executionState'], created: i['creationTime'], modified: i['lastModificationTime'], dueDate: i['dueDate'] ?? null }; }
  async searchInstances(fl: InstanceFilter): Promise<InstanceSearchResult> {
    await this.ready; let list = [...this.instances.values()];
    if (fl.statuses?.length) list = list.filter(i => fl.statuses!.includes(i['executionState']));
    if (fl.text) list = list.filter(i => String(i['name']).toLowerCase().includes(fl.text!.toLowerCase()));
    if (fl.process) list = list.filter(i => i['processTemplateName'] === fl.process); if (fl.app) list = list.filter(i => i['processAppAcronym'] === fl.app);
    if (fl.involvedOnly) list = list.filter(i => (i['tasks'] as Json[]).some(t => this.visible(t)));
    let rows = list.map(i => this.irow(i)); const key = { instanceModifyDate: (r: InstanceRow) => r.modified ?? '', instanceCreateDate: (r: InstanceRow) => r.created ?? '', instanceDueDate: (r: InstanceRow) => r.dueDate ?? '9', instanceName: (r: InstanceRow) => r.name, bpdName: (r: InstanceRow) => r.processName }[fl.sort ?? 'instanceModifyDate'] ?? ((r: InstanceRow) => r.modified ?? '');
    rows.sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; }); if (fl.sortDir !== 'asc') rows.reverse();
    const offset = fl.offset ?? 0, size = fl.size ?? 25; return { rows: rows.slice(offset, offset + size), totalCount: rows.length, offset, size };
  }
  async instance(id: string): Promise<InstanceDetails> {
    await this.ready; const i = this.instances.get(id); if (!i) this.notFound(`Process instance '${id}'`);
    const tokens: { tokenId: string; name: string; flowObjectId: string; taskIds: string[] }[] = []; const walk = (n: Json) => { if (!n) return; if (n['tokenId']) tokens.push({ tokenId: String(n['tokenId']), name: n['name'], flowObjectId: n['flowObjectId'], taskIds: (n['createdTaskIDs'] ?? []).map(String) }); for (const c of n['children'] ?? []) walk(c); }; walk(i['executionTree']?.['root']);
    const comments = (i['comments'] ?? []).map((c: Json) => ({ id: String(c['commentId'] ?? c['id'] ?? ''), author: c['fullName'] ?? c['user'] ?? '', created: c['timeStamp'] ?? c['creationTime'] ?? '', text: c['text'] ?? c['comment'] ?? '' }));
    return { ...clone(i), tasks: (i['tasks'] as Json[]).map(t => clone(t)), variables: i['variables'] ?? i['data']?.['variables'] ?? {}, comments, diagram: i['diagram'] ?? i['diagram']?.['step'] ?? [], tokens, actions: i['_actions']?.['standardActions'] ?? [] } as InstanceDetails;
  }
  async instanceAction(id: string, action: 'suspend' | 'resume' | 'terminate' | 'retry' | 'delete') {
    await this.ready; const i = this.instances.get(id); if (!i) this.notFound(`Process instance '${id}'`);
    if (action === 'delete') { this.instances.delete(id); for (const t of i['tasks'] as Json[]) this.tasks.delete(String(t['tkiid'])); return; }
    if (action === 'suspend') { if (i['executionState'] !== 'Active') this.refuse('CWTBG0019E', 'Only an active instance can be suspended.'); i['executionState'] = 'Suspended'; i['state'] = 'STATE_SUSPENDED'; }
    if (action === 'resume') { i['executionState'] = 'Active'; i['state'] = 'STATE_RUNNING'; }
    if (action === 'retry') { i['executionState'] = 'Active'; i['state'] = 'STATE_RUNNING'; }
    if (action === 'terminate') { i['executionState'] = 'Terminated'; i['state'] = 'STATE_TERMINATED'; for (const t of i['tasks'] as Json[]) if (OPEN.has(t['status'])) { t['status'] = 'Closed'; t['state'] = 'STATE_CANCELED'; t['completionTime'] = now(); } }
    i['lastModificationTime'] = now(); this.log('i' + id, `${this.user}: ${action}`);
  }
  async setInstanceDueDate(id: string, iso: string) { await this.ready; const i = this.instances.get(id); if (!i) this.notFound(`Process instance '${id}'`); i['dueDate'] = iso; }
  async commentInstance(id: string, text: string) { await this.ready; const i = this.instances.get(id); if (!i) this.notFound(`Process instance '${id}'`); (i['comments'] ??= []).push({ commentId: String(++this.seq), fullName: this.user, timeStamp: now(), text }); this.log('i' + id, text); }
  async instanceStream(id: string) { await this.ready; return this.streams.get('i' + id) ?? []; }
  async followInstance(id: string, follow: boolean) { follow ? this.follows.add('i' + id) : this.follows.delete('i' + id); }
  async isFollowingInstance(id: string) { return this.follows.has('i' + id); }
  async statusOverview(): Promise<StatusOverview> { await this.ready; const o: StatusOverview = { Active: 0, Failed: 0, Completed: 0, Terminated: 0, Did_not_Start: 0, Suspended: 0 }; for (const i of this.instances.values()) (o as Json)[i['executionState']] = ((o as Json)[i['executionState']] ?? 0) + 1; return o; }

  // ---------------------------------------------------------------- saved searches, notifications
  async savedSearches() { await this.ready; return clone(this.searches); }
  async saveSearch(s: { id?: string; name: string; description?: string; shared: boolean; filter: TaskFilter }): Promise<SavedSearch> { await this.ready; const ex = s.id ? this.searches.find(x => x.id === s.id) : null; const def = { id: ex?.id ?? String(++this.seq), name: s.name, shared: s.shared, definition: { name: s.name, organization: 'byTask', conditions: [] }, filter: { ...s.filter } } as SavedSearch; if (ex) Object.assign(ex, def); else this.searches.push(def); return clone(def); }
  async deleteSearch(id: string) { this.searches = this.searches.filter(s => s.id !== id); }
  async mentions(): Promise<StreamItem[]> { return []; }
}
