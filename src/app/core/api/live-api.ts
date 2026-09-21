import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BpmApi } from './bpm-api';
import { Priority, CurrentUser, DiagramStep, ExposedProcess, GroupSummary, InstanceDetails, InstanceFilter, InstanceRow, InstanceSearchResult, ProcessModel, SavedSearch, StatusOverview, StreamItem, TaskDetails, TaskFilter, TaskRow, TaskSearchResult, TaskStats, TeamInfo, TokenInfo, UserSummary } from './models';

type Json = Record<string, any>;
const OPEN_STATUSES = ['Received', 'Replied', 'Forwarded', 'Sent', 'New', 'Special', 'Collaboration'];
const TASK_COLUMNS = 'taskId,taskSubject,taskStatus,taskPriority,taskDueDate,taskReceivedDate,taskClosedDate,taskIsAtRisk,taskActivityName,assignedToUser,assignedToRole,assignedToRoleDisplayName,taskReceivedFrom,instanceId,instanceName,bpdName,bpdId,instanceStatus,instanceCreateDate,instanceModifyDate,instanceDueDate,instanceProcessApp';
const INSTANCE_COLUMNS = 'instanceId,instanceName,bpdName,bpdId,instanceStatus,instanceCreateDate,instanceModifyDate,instanceDueDate,instanceProcessApp,instanceSnapshot';
const PAGE = 500;   // maximum rows of one search query call
const CAP = 3000;   // rows fetched at most for client-side sorting / paging

/** Live implementation: the classic Process REST API (rest/bpm/wle/v1) of a Process Center / Process Server, verified on BAW 8.6.2.
 *  Lists come from PUT /search/query (columns, repeated pipe-separated conditions, ascending sort); details, actions, social,
 *  organization, launch and saved searches from their own resources. See docs/ENDPOINTS.md of the repository. */
@Injectable({ providedIn: 'root' })
export class LiveApi implements BpmApi {
  readonly mode = 'live' as const;
  private readonly http = inject(HttpClient);
  private readonly base = environment.restBase;
  private me: CurrentUser | null = null;
  private cache = new Map<string, { at: number; rows: Json[] }>();

  // ---------------------------------------------------------------- transport
  private async get<T = Json>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const r = await firstValueFrom(this.http.get<Json>(this.base + path, { params: this.params(params) })); return (r['data'] ?? r) as T;
  }
  private async send<T = Json>(method: 'put' | 'post' | 'delete', path: string, params?: Record<string, string | number | boolean | undefined>, body: unknown = null): Promise<T> {
    const r = await firstValueFrom(this.http.request<Json>(method, this.base + path, { params: this.params(params), body })); return (r?.['data'] ?? r) as T;
  }
  private params(p?: Record<string, string | number | boolean | undefined>): HttpParams {
    let h = new HttpParams();
    for (const [k, v] of Object.entries(p ?? {})) if (v !== undefined && v !== null) h = h.set(k, String(v));
    return h;
  }
  /** PUT /search/query with repeated condition parameters (AND). Fetches up to `max` rows in pages of 500. */
  private async query(organization: 'byTask' | 'byInstance', columns: string, conditions: string[], sort: string, extra: Record<string, string> = {}, max = CAP): Promise<{ rows: Json[]; total: number }> {
    const key = JSON.stringify([organization, columns, conditions, sort, extra, max]); const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 4000) return { rows: hit.rows, total: hit.rows.length };
    const rows: Json[] = []; let offset = 0; let total = 0;
    while (rows.length < max) {
      let h = new HttpParams().set('organization', organization).set('columns', columns).set('sort', sort).set('size', String(Math.min(PAGE, max - rows.length))).set('offset', String(offset));
      for (const c of conditions) h = h.append('condition', c);
      for (const [k, v] of Object.entries(extra)) h = h.set(k, v);
      const r = await firstValueFrom(this.http.put<Json>(this.base + '/search/query', null, { params: h })); const d = r['data'] ?? {};
      const page: Json[] = d['data'] ?? []; rows.push(...page); total = d['totalCount'] ?? rows.length;
      if (page.length < PAGE || rows.length >= total) break;
      offset += PAGE;
    }
    this.cache.set(key, { at: Date.now(), rows }); return { rows, total };
  }
  invalidate() { this.cache.clear(); }

  // ---------------------------------------------------------------- users, groups, teams, profile
  async currentUser(): Promise<CurrentUser> {
    const d = await this.get<Json>('/user/current', { includeEditableUserPreferences: true });
    this.me = { userID: d['userID'], userName: d['userName'], fullName: d['fullName'] || d['userName'], emailAddress: d['emailAddress'] ?? null, memberships: d['memberships'] ?? [], userPreferences: d['userPreferences'] ?? {}, editableUserPreferences: d['editableUserPreferences'] ?? [] };
    return this.me;
  }
  async users(filter = '*'): Promise<UserSummary[]> {
    const d = await this.get<Json>('/users', { filter: filter.includes('*') ? filter : filter + '*', maxresult: 200 });
    return (d['users'] ?? []).map((u: Json) => ({ userID: u['userID'], userName: u['userName'], fullName: u['fullName'] || u['userName'], emailAddress: u['emailAddress'] ?? null }));
  }
  async groups(filter = '*'): Promise<GroupSummary[]> {
    const d = await this.get<Json>('/groups', { filter: filter.includes('*') ? filter : filter + '*' });
    return (d['groups'] ?? []).filter((g: Json) => !g['deleted']).map((g: Json) => ({ groupID: g['groupID'], groupName: g['groupName'], displayName: g['displayName'] || g['groupName'], description: g['description'] ?? '', members: g['members'] ?? [] }));
  }
  /** Teams = the security groups the engine creates per team ("Name_T_<uuid>.<snapshot>"), grouped by display name, plus the plain groups. */
  async teams(): Promise<TeamInfo[]> {
    const groups = await this.groups('*'); const byName = new Map<string, TeamInfo>();
    for (const g of groups) {
      const m = /^(.+?)_[TS]_[0-9a-f-]+(?:\.[0-9a-f-]+)?$/.exec(g.groupName); const name = m ? m[1] : g.groupName;
      const t = byName.get(name) ?? { name: g.groupName, displayName: name, members: [], description: g.description };
      for (const u of g.members) if (!t.members.includes(u)) t.members.push(u);
      byName.set(name, t);
    }
    return [...byName.values()].filter(t => !environment.scopeTeams.length || environment.scopeTeams.includes(t.displayName)).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  /** The engine answers JSON: {userAvatarImage (base64), imageFormat, isDefault}; a default (generated) avatar yields null so the initials show. */
  async avatar(user?: string): Promise<string | null> {
    try {
      const d = await this.get<Json>(user ? `/avatar/${encodeURIComponent(user)}` : '/avatar/current');
      if (!d['userAvatarImage']) return null;   // isDefault arrives as the string "false" / "true"; a default picture is still a picture, so it is shown
      const fmt = String(d['imageFormat'] || 'png').toLowerCase().replace('jpg', 'jpeg');
      return `data:image/${fmt};base64,${d['userAvatarImage']}`;
    } catch { return null; }
  }
  async setAvatar(dataUrl: string | null): Promise<void> {
    if (!dataUrl) { await this.send('delete', '/avatar/current'); return; }
    const blob = await (await fetch(dataUrl)).blob(); const fd = new FormData(); fd.append('avatar', blob, 'avatar.png');
    await firstValueFrom(this.http.post(this.base + '/avatar/current', fd));
  }
  async setPreferences(prefs: Record<string, string>): Promise<void> {
    const me = this.me ?? await this.currentUser();
    await this.send('put', `/user/${encodeURIComponent(me.userName)}`, { action: 'setPreferences', prefs: JSON.stringify(prefs) });
  }

  // ---------------------------------------------------------------- tasks
  /** Registered searchable business data aliases (GET /searches/tasks/meta/businessDataFields), cached for the session; [] when the engine has none. */
  private aliasesP?: Promise<string[]>;
  private aliases(): Promise<string[]> {
    return this.aliasesP ??= firstValueFrom(this.http.get<Json>(this.base + '/searches/tasks/meta/businessDataFields'))
      .then(r => ((r['data'] ?? {})['result'] ?? []).map((f: Json) => String(f['name'])).filter((n: string) => /^[A-Za-z][A-Za-z0-9_]*$/.test(n)))
      .catch(() => []);
  }
  /** BAW 8.6.x lists every alias but answers a 500 (NullPointerException) for aliases without pivot columns (snapshots imported rather than
   *  authored in the designer); CP4BA 25 serves them all. After a failed query, keep only the aliases the engine accepts one by one (once per session). */
  private async usableAliases(aliases: string[]): Promise<string[]> {
    const ok: string[] = [];
    for (const n of aliases) {
      try { await this.query('byTask', 'taskId,' + n, [], 'taskId', {}, 1); ok.push(n); } catch { /* no pivot column for this alias on this engine */ }
    }
    this.aliasesP = Promise.resolve(ok); return ok;
  }
  private taskRow(r: Json, aliases: string[] = []): TaskRow {
    const a = r['taskAssignedTo'] ?? null;
    const businessData: Record<string, string> = {};
    for (const n of aliases) if (r[n] !== undefined && r[n] !== null && r[n] !== '') businessData[n] = String(r[n]);
    return { ...(Object.keys(businessData).length ? { businessData } : {}), taskId: r['taskId'], subject: r['taskSubject'] ?? '', status: r['taskStatus'], priority: r['taskPriority'] ?? 'Normal', dueDate: r['taskDueDate'] ?? null, assignedTo: r['assignedToUser'] ?? (a ? a['who'] : null), assignedType: a ? a['type'] : null,
      instanceId: r['instanceId'], instanceName: r['instanceName'] ?? '', processName: r['bpdName'] ?? '', appAcronym: r['instanceProcessApp'] ?? '', instanceStatus: r['instanceStatus'] ?? '', instanceDueDate: r['instanceDueDate'] ?? null, created: r['taskReceivedDate'] ?? null, isAtRisk: !!r['taskIsAtRisk'] };
  }
  private taskConditions(f: TaskFilter): { conditions: string[]; extra: Record<string, string> } {
    const conditions: string[] = []; const extra: Record<string, string> = {};
    if (f.scope === 'closed') conditions.push('taskStatus|Equals|Closed');
    else if (f.statuses?.length === 1) conditions.push(`taskStatus|Equals|${f.statuses[0]}`);
    else if (f.scope !== 'all') conditions.push('taskStatus|Equals|New_or_Received');
    if (f.scope === 'mine' || f.scope === 'team') extra['filterByCurrentUser'] = 'true';
    if (f.user) conditions.push(`assignedToUser|Equals|${f.user}`);
    if (f.text) conditions.push(`taskSubject|Contains|${f.text}`);
    if (f.process) conditions.push(`bpdName|Equals|${f.process}`);
    if (f.app) conditions.push(`instanceProcessApp|Equals|${f.app}`); else if (environment.scopeApps.length === 1) conditions.push(`instanceProcessApp|Equals|${environment.scopeApps[0]}`);
    if (f.priorities?.length === 1) conditions.push(`taskPriority|Equals|${f.priorities[0]}`);
    if (f.due === 'overdue') conditions.push(`taskDueDate|LessThan|${new Date().toISOString()}`);
    return { conditions, extra };
  }
  async searchTasks(f: TaskFilter): Promise<TaskSearchResult> {
    const { conditions, extra } = this.taskConditions(f);
    const sortCol = f.sort && TASK_COLUMNS.split(',').includes(f.sort) ? f.sort : 'taskDueDate';
    let aliases = await this.aliases(); let rows: Json[];
    try { rows = (await this.query('byTask', aliases.length ? TASK_COLUMNS + ',' + aliases.join(',') : TASK_COLUMNS, conditions, sortCol, extra)).rows; }
    catch (e) { if (!aliases.length) throw e; aliases = await this.usableAliases(aliases); rows = (await this.query('byTask', aliases.length ? TASK_COLUMNS + ',' + aliases.join(',') : TASK_COLUMNS, conditions, sortCol, extra)).rows; }
    let list = rows.map(r => this.taskRow(r, aliases)); const me = this.me?.userName;
    if (environment.scopeApps.length > 1) list = list.filter(t => environment.scopeApps.includes(t.appAcronym));
    if (f.scope === 'mine') list = list.filter(t => t.assignedType !== 'Group' || t.assignedTo === me);   // received by me or claimed by me
    if (f.scope === 'team') list = list.filter(t => t.assignedType === 'Group');                          // available to my teams
    if (f.statuses && f.statuses.length > 1) list = list.filter(t => f.statuses!.includes(t.status));
    if (f.priorities && f.priorities.length > 1) list = list.filter(t => f.priorities!.includes(t.priority));
    if (f.due === 'today') { const d = new Date().toDateString(); list = list.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === d); }
    if (f.due === 'week') { const end = Date.now() + 7 * 86400000; list = list.filter(t => t.dueDate && new Date(t.dueDate).getTime() <= end); }
    if (f.sortDir === 'desc') list.reverse();
    const offset = f.offset ?? 0; const size = f.size ?? 25;
    return { rows: list.slice(offset, offset + size), totalCount: list.length, offset, size };
  }
  async taskStats(scope: TaskFilter['scope']): Promise<TaskStats> {
    const all = await this.searchTasks({ scope, size: CAP }); const now = Date.now(); const s: TaskStats = { total: all.totalCount, onTrack: 0, atRisk: 0, overdue: 0, byPriority: {}, byStatus: {} };
    for (const t of all.rows) {
      if (t.dueDate && new Date(t.dueDate).getTime() < now) s.overdue++; else if (t.isAtRisk) s.atRisk++; else s.onTrack++;
      s.byPriority[t.priority] = (s.byPriority[t.priority] ?? 0) + 1; s.byStatus[t.status] = (s.byStatus[t.status] ?? 0) + 1;
    }
    return s;
  }
  async task(id: string): Promise<TaskDetails> {
    const d = await this.get<Json>(`/task/${id}`, { parts: 'all' });
    const type = d['assignedToType'] ? String(d['assignedToType']).charAt(0).toUpperCase() + String(d['assignedToType']).slice(1).toLowerCase() : null;   // details say "user" / "group", searches "User" / "Group"
    return { ...(d as TaskDetails), assignedToType: type, data: d['data'] ?? { variables: {} }, actions: d['actions'] ?? null };
  }
  async taskActions(ids: string[]): Promise<Record<string, string[]>> {
    const d = await this.get<Json>('/task/actions', { taskIDs: ids.join(',') }); const out: Record<string, string[]> = {};
    for (const t of d['tasks'] ?? []) out[String(t['tkiid'])] = t['actions'] ?? [];
    return out;
  }
  async claim(id: string) { await this.send('put', `/task/${id}`, { action: 'assign', toMe: true, parts: 'none' }); this.invalidate(); }
  async release(id: string) { await this.send('put', `/task/${id}`, { action: 'assign', back: true, parts: 'none' }); this.invalidate(); }
  async assign(id: string, target: { user?: string; group?: string }) { await this.send('put', `/task/${id}`, { action: 'assign', toUser: target.user, toGroup: target.group, parts: 'none' }); this.invalidate(); }
  async bulkClaim(ids: string[]) { await this.send('put', '/task', { action: 'claim', taskIDs: ids.join(',') }); this.invalidate(); }
  async bulkCancel(ids: string[]) { await this.send('put', '/task', { action: 'cancel', taskIDs: ids.join(',') }); this.invalidate(); }
  async setPriority(id: string, priority: string) { await this.send('put', `/task/${id}`, { action: 'update', priority, parts: 'none' }); this.invalidate(); }
  async setDueDate(id: string, iso: string) { await this.send('put', `/task/${id}`, { action: 'update', dueDate: iso, parts: 'none' }); this.invalidate(); }
  async complete(id: string, params: Record<string, unknown>) { await this.send('put', `/task/${id}`, { action: 'complete', params: JSON.stringify(params), parts: 'none' }); this.invalidate(); }
  async saveTaskData(id: string, params: Record<string, unknown>) { await this.send('put', `/task/${id}`, { action: 'setData', params: JSON.stringify(params) }); }
  async cancelTask(id: string) { await this.send('put', `/task/${id}`, { action: 'cancel', parts: 'none' }); this.invalidate(); }
  async taskStream(id: string): Promise<StreamItem[]> { const d = await this.get<Json>(`/social/task/${id}/stream`, { sort: 'desc', pagesize: 50 }); return d['items'] ?? []; }
  /** The social task comment answers {posted: true} but never shows in any stream on 8.6.2; the instance comment does (task and instance streams), so a task comment is posted on its instance, prefixed with the task name. */
  async commentTask(id: string, text: string) {
    const t = await this.get<Json>(`/task/${id}`, { parts: 'header' });
    await this.send('post', `/process/${t['piid']}`, { action: 'comment', comment: `[${t['displayName'] || t['name']}] ${text}`, parts: 'none' });
  }
  async followTask(id: string, follow: boolean) { await this.send(follow ? 'post' : 'delete', `/social/task/${id}/following`); }
  async isFollowingTask(id: string): Promise<boolean> { try { const d = await this.get<Json>(`/social/task/${id}/following`); return !!(d['following'] ?? d['isFollowing'] ?? false); } catch { return false; } }

  // ---------------------------------------------------------------- launch
  async exposedProcesses(): Promise<ExposedProcess[]> {
    const d = await this.get<Json>('/exposed/process'); const seen = new Set<string>(); const out: ExposedProcess[] = [];
    for (const i of d['exposedItemsList'] ?? []) { const key = i['itemID'] + '@' + i['snapshotID']; if (seen.has(key)) continue; if (environment.scopeApps.length && !environment.scopeApps.includes(i['processAppAcronym'])) continue; seen.add(key); out.push(i as ExposedProcess); }
    return out.sort((a, b) => a.processAppName.localeCompare(b.processAppName) || a.display.localeCompare(b.display));
  }
  async processModel(bpdId: string, snapshotId: string): Promise<ProcessModel> {
    const d = await this.get<Json>(`/processModel/${bpdId}`, { snapshotId });
    const inputs = Object.entries(d['DataModel']?.['inputs'] ?? {}).map(([name, v]: [string, any]) => ({ name, type: v['type'] ?? v['className'] ?? 'String', isList: !!v['isList'], classId: v['classId'] ?? '' }));
    return { name: d['Header']?.['name'] ?? '', description: d['Header']?.['description'] ?? '', inputs, steps: (d['Diagram']?.['step'] ?? []) as DiagramStep[] };
  }
  async startProcess(bpdId: string, snapshotId: string, params: Record<string, unknown>): Promise<{ piid: string; name: string; firstTaskId?: string }> {
    const items = await this.exposedProcesses(); const item = items.find(i => i.itemID === bpdId && i.snapshotID === snapshotId) ?? items.find(i => i.itemID === bpdId);
    const p: Record<string, string> = { action: 'start', bpdId, params: JSON.stringify(params), parts: 'all' };
    if (item?.tip && item.branchID) p['branchId'] = item.branchID; else p['snapshotId'] = snapshotId;
    const d = await this.send<Json>('post', '/process', p); this.invalidate();
    const first = (d['tasks'] ?? []).find((t: Json) => OPEN_STATUSES.includes(t['status']));
    return { piid: String(d['piid']), name: d['name'] ?? '', firstTaskId: first ? String(first['tkiid']) : undefined };
  }

  // ---------------------------------------------------------------- instances
  private instanceRow(r: Json): InstanceRow {
    return { instanceId: r['instanceId'], name: r['instanceName'] ?? '', processName: r['bpdName'] ?? '', appAcronym: r['instanceProcessApp'] ?? '', status: r['instanceStatus'] ?? '', created: r['instanceCreateDate'] ?? null, modified: r['instanceModifyDate'] ?? null, dueDate: r['instanceDueDate'] ?? null };
  }
  async searchInstances(f: InstanceFilter): Promise<InstanceSearchResult> {
    const conditions: string[] = []; const extra: Record<string, string> = {};
    if (f.statuses?.length === 1) conditions.push(`instanceStatus|Equals|${f.statuses[0]}`);
    if (f.text) conditions.push(`instanceName|Contains|${f.text}`);
    if (f.process) conditions.push(`bpdName|Equals|${f.process}`);
    if (f.app) conditions.push(`instanceProcessApp|Equals|${f.app}`); else if (environment.scopeApps.length === 1) conditions.push(`instanceProcessApp|Equals|${environment.scopeApps[0]}`);
    if (f.involvedOnly) extra['filterByCurrentUser'] = 'true';
    const sortCol = f.sort && INSTANCE_COLUMNS.split(',').includes(f.sort) ? f.sort : 'instanceModifyDate';
    const { rows } = await this.query('byInstance', INSTANCE_COLUMNS, conditions, sortCol, extra);
    const seen = new Set<number>(); let list: InstanceRow[] = [];
    for (const r of rows) { if (seen.has(r['instanceId'])) continue; seen.add(r['instanceId']); list.push(this.instanceRow(r)); }
    if (environment.scopeApps.length > 1) list = list.filter(i => environment.scopeApps.includes(i.appAcronym));
    if (f.statuses && f.statuses.length > 1) list = list.filter(i => f.statuses!.includes(i.status));
    if (f.sortDir !== 'asc') list.reverse();   // newest first by default
    const offset = f.offset ?? 0; const size = f.size ?? 25;
    return { rows: list.slice(offset, offset + size), totalCount: list.length, offset, size };
  }
  async instance(id: string): Promise<InstanceDetails> {
    const d = await this.get<Json>(`/process/${id}`, { parts: 'all' });
    const tokens: TokenInfo[] = []; const walk = (n: Json) => { if (!n) return; if (n['tokenId']) tokens.push({ tokenId: String(n['tokenId']), name: n['name'] ?? '', flowObjectId: n['flowObjectId'] ?? '', taskIds: (n['createdTaskIDs'] ?? []).map(String) }); for (const c of n['children'] ?? []) walk(c); };
    walk(d['executionTree']?.['root']);
    const variables = d['variables'] ?? d['data']?.['variables'] ?? {};
    const comments = (d['comments'] ?? []).map((c: Json, i: number) => ({ id: String(c['commentId'] ?? c['id'] ?? i), author: c['who'] ?? c['fullName'] ?? c['user'] ?? '', created: c['date'] ?? c['timeStamp'] ?? '', text: c['message'] ?? c['text'] ?? c['comment'] ?? '' }));   // 8.6.2: {who, date, message}
    let actions: string[] = [];
    try { const a = await this.get<Json>(`/process/${id}/actions`); actions = a['standardActions'] ?? a['actions'] ?? []; } catch { /* optional */ }
    return { ...(d as InstanceDetails), tasks: d['tasks'] ?? [], variables, comments, diagram: d['diagram']?.['step'] ?? [], tokens, actions };
  }
  async instanceAction(id: string, action: 'suspend' | 'resume' | 'terminate' | 'retry' | 'delete') {
    if (action === 'delete') await this.send('delete', `/process/${id}`, { action: 'delete', parts: 'none' });
    else await this.send(action === 'terminate' ? 'post' : 'put', `/process/${id}`, { action, parts: 'none' });
    this.invalidate();
  }
  async setInstanceDueDate(id: string, iso: string) { await this.send('put', `/process/${id}`, { action: 'update', dueDate: iso, parts: 'none' }); this.invalidate(); }
  async commentInstance(id: string, text: string) { await this.send('post', `/process/${id}`, { action: 'comment', comment: text, parts: 'none' }); }
  async instanceStream(id: string): Promise<StreamItem[]> { const d = await this.get<Json>(`/social/instance/${id}/stream`, { sort: 'desc', pagesize: 50 }); return d['items'] ?? []; }
  async followInstance(id: string, follow: boolean) { await this.send(follow ? 'post' : 'delete', `/social/instance/${id}/following`); }
  async isFollowingInstance(id: string): Promise<boolean> { try { const d = await this.get<Json>(`/social/instance/${id}/following`); return !!(d['following'] ?? d['isFollowing'] ?? false); } catch { return false; } }
  async statusOverview(): Promise<StatusOverview> {
    if (environment.scopeApps.length) {   // the engine overview covers every application: count the scoped instances instead
      const o: StatusOverview = { Active: 0, Failed: 0, Completed: 0, Terminated: 0, Did_not_Start: 0, Suspended: 0 };
      const all = await this.searchInstances({ size: CAP }); for (const i of all.rows) (o as Json)[i.status] = ((o as Json)[i.status] ?? 0) + 1; return o;
    }
    const d = await this.get<Json>('/processes/status/overview'); return d['overview'] as StatusOverview;
  }

  // ---------------------------------------------------------------- saved searches (engine resource /searches/tasks, executed through the search query)
  private filterToDefinition(name: string, shared: boolean, f: TaskFilter): Json {
    const conditions: Json[] = []; const { conditions: raw } = this.taskConditions(f);
    for (const c of raw) { const [field, operator, value] = c.split('|'); conditions.push({ field, operator, value }); }
    return { name, organization: 'byTask', shared, teams: [], size: f.size ?? 25, interaction: null, fields: TASK_COLUMNS.split(','), aliases: [], sort: [{ field: f.sort ?? 'taskDueDate', order: (f.sortDir ?? 'asc').toUpperCase() }], conditions, ...(f.scope ? {} : {}) };
  }
  private definitionToFilter(d: Json): TaskFilter {
    const f: TaskFilter = { scope: 'all', statuses: [], priorities: [] };
    for (const c of d['conditions'] ?? []) {
      const v = String(c['value'] ?? '');
      if (c['field'] === 'taskStatus') { if (v === 'Closed') f.scope = 'closed'; else if (v !== 'New_or_Received') f.statuses = [v]; }
      else if (c['field'] === 'assignedToUser') f.user = v; else if (c['field'] === 'taskSubject') f.text = v; else if (c['field'] === 'bpdName') f.process = v; else if (c['field'] === 'instanceProcessApp') f.app = v; else if (c['field'] === 'taskPriority') f.priorities = [v as Priority];
    }
    const s = (d['sort'] ?? [])[0]; if (s) { f.sort = s['field']; f.sortDir = String(s['order'] ?? 'ASC').toLowerCase() as 'asc' | 'desc'; }
    if (d['size']) f.size = d['size'];
    return f;
  }
  async savedSearches(): Promise<SavedSearch[]> {
    const d = await this.get<Json>('/searches/tasks'); const out: SavedSearch[] = [];
    for (const s of d['definitions'] ?? []) {
      if (String(s['name']).startsWith('IBM.') || String(s['name']).startsWith('portal.')) continue;   // the engine's own portal definitions
      const def = await this.get<Json>(`/searches/tasks/${s['id']}`);
      out.push({ id: String(s['id']), name: s['name'], shared: !!s['shared'], owner: s['owner'] ?? undefined, definition: def, filter: this.definitionToFilter(def) } as SavedSearch & { filter: TaskFilter });
    }
    return out;
  }
  async saveSearch(search: { id?: string; name: string; description?: string; shared: boolean; filter: TaskFilter }): Promise<SavedSearch> {
    const body = this.filterToDefinition(search.name, search.shared, search.filter);
    const d = search.id ? await this.send<Json>('put', `/searches/tasks/${search.id}`, {}, body) : await this.send<Json>('post', '/searches/tasks', {}, body);
    return { id: String(d['id'] ?? search.id ?? ''), name: search.name, shared: search.shared, definition: d };
  }
  async deleteSearch(id: string) { await this.send('delete', `/searches/tasks/${id}`); }

  // ---------------------------------------------------------------- notifications
  async mentions(): Promise<StreamItem[]> { const d = await this.get<Json>('/social/instances/mentions', { pagesize: 50 }); return d['items'] ?? []; }
}
