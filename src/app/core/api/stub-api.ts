import { Injectable } from '@angular/core';
import { BpmApi } from './bpm-api';
import { CurrentUser, ExposedProcess, GroupSummary, InstanceDetails, InstanceFilter, InstanceSearchResult, ProcessModel, SavedSearch, StatusOverview, StreamItem, TaskDetails, TaskFilter, TaskSearchResult, TaskStats, TeamInfo, UserSummary } from './models';
import { StubEngine } from './stub-engine';

/** Demo implementation: an in-memory engine seeded with fixtures captured from the lab; every operation mutates the fixtures the way the
 *  real engine would (claim, complete -> next task per the sample process definitions, start, comments, saved searches). */
@Injectable({ providedIn: 'root' })
export class StubApi implements BpmApi {
  readonly mode = 'demo' as const;
  private readonly e = new StubEngine();
  private delay<T>(v: Promise<T> | T, ms = 120): Promise<T> { return new Promise((res, rej) => setTimeout(() => Promise.resolve(v).then(res, rej), ms)); }
  setUser(user: string) { this.e.setUser(user); }
  currentUser() { return this.delay(this.e.currentUser()); }
  users(filter?: string) { return this.delay(this.e.users(filter)); }
  groups(filter?: string) { return this.delay(this.e.groups(filter)); }
  teams() { return this.delay(this.e.teams()); }
  avatar(user?: string) { return this.delay(this.e.avatar(user)); }
  setAvatar(dataUrl: string | null) { return this.delay(this.e.setAvatar(dataUrl)); }
  setPreferences(prefs: Record<string, string>) { return this.delay(this.e.setPreferences(prefs)); }
  searchTasks(filter: TaskFilter) { return this.delay(this.e.searchTasks(filter)); }
  taskStats(scope: TaskFilter['scope']) { return this.delay(this.e.taskStats(scope)); }
  task(id: string) { return this.delay(this.e.task(id)); }
  taskActions(ids: string[]) { return this.delay(this.e.taskActions(ids)); }
  claim(id: string) { return this.delay(this.e.claim(id)); }
  release(id: string) { return this.delay(this.e.release(id)); }
  assign(id: string, target: { user?: string; group?: string }) { return this.delay(this.e.assign(id, target)); }
  bulkClaim(ids: string[]) { return this.delay(this.e.bulkClaim(ids)); }
  bulkCancel(ids: string[]) { return this.delay(this.e.bulkCancel(ids)); }
  setPriority(id: string, priority: string) { return this.delay(this.e.setPriority(id, priority)); }
  setDueDate(id: string, iso: string) { return this.delay(this.e.setDueDate(id, iso)); }
  complete(id: string, params: Record<string, unknown>) { return this.delay(this.e.complete(id, params), 300); }
  saveTaskData(id: string, params: Record<string, unknown>) { return this.delay(this.e.saveTaskData(id, params)); }
  cancelTask(id: string) { return this.delay(this.e.cancelTask(id)); }
  taskStream(id: string) { return this.delay(this.e.taskStream(id)); }
  commentTask(id: string, text: string) { return this.delay(this.e.commentTask(id, text)); }
  followTask(id: string, follow: boolean) { return this.delay(this.e.followTask(id, follow)); }
  isFollowingTask(id: string) { return this.delay(this.e.isFollowingTask(id)); }
  exposedProcesses() { return this.delay(this.e.exposedProcesses()); }
  processModel(bpdId: string, snapshotId: string) { return this.delay(this.e.processModel(bpdId, snapshotId)); }
  startProcess(bpdId: string, snapshotId: string, params: Record<string, unknown>) { return this.delay(this.e.startProcess(bpdId, snapshotId, params), 400); }
  searchInstances(filter: InstanceFilter) { return this.delay(this.e.searchInstances(filter)); }
  instance(id: string) { return this.delay(this.e.instance(id)); }
  instanceAction(id: string, action: 'suspend' | 'resume' | 'terminate' | 'retry' | 'delete') { return this.delay(this.e.instanceAction(id, action)); }
  setInstanceDueDate(id: string, iso: string) { return this.delay(this.e.setInstanceDueDate(id, iso)); }
  commentInstance(id: string, text: string) { return this.delay(this.e.commentInstance(id, text)); }
  instanceStream(id: string) { return this.delay(this.e.instanceStream(id)); }
  followInstance(id: string, follow: boolean) { return this.delay(this.e.followInstance(id, follow)); }
  isFollowingInstance(id: string) { return this.delay(this.e.isFollowingInstance(id)); }
  statusOverview() { return this.delay(this.e.statusOverview()); }
  savedSearches() { return this.delay(this.e.savedSearches()); }
  saveSearch(search: { id?: string; name: string; description?: string; shared: boolean; filter: TaskFilter }) { return this.delay(this.e.saveSearch(search)); }
  deleteSearch(id: string) { return this.delay(this.e.deleteSearch(id)); }
  mentions() { return this.delay(this.e.mentions()); }
}
export type { CurrentUser, ExposedProcess, GroupSummary, InstanceDetails, InstanceSearchResult, ProcessModel, SavedSearch, StatusOverview, StreamItem, TaskDetails, TaskSearchResult, TaskStats, TeamInfo, UserSummary };
