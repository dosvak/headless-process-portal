import { InjectionToken, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CurrentUser, ExposedProcess, GroupSummary, InstanceDetails, InstanceFilter, InstanceSearchResult, ProcessModel, SavedSearch, StatusOverview, StreamItem, TaskDetails, TaskFilter, TaskSearchResult, TaskStats, TeamInfo, UserSummary } from './models';
import { LiveApi } from './live-api';
import { StubApi } from './stub-api';

/** Every function of the portal, engine-only: implemented by LiveApi (classic REST API of a Process Center / Process Server) and by
 *  StubApi (in-memory fixtures + engine for the demo). Components never talk to HTTP directly. */
export interface BpmApi {
  readonly mode: 'live' | 'demo';
  currentUser(): Promise<CurrentUser>;
  users(filter?: string): Promise<UserSummary[]>;
  groups(filter?: string): Promise<GroupSummary[]>;
  teams(): Promise<TeamInfo[]>;
  avatar(user?: string): Promise<string | null>;
  setAvatar(dataUrl: string | null): Promise<void>;
  setPreferences(prefs: Record<string, string>): Promise<void>;
  // tasks
  searchTasks(filter: TaskFilter): Promise<TaskSearchResult>;
  taskStats(scope: TaskFilter['scope']): Promise<TaskStats>;
  task(id: string): Promise<TaskDetails>;
  taskActions(ids: string[]): Promise<Record<string, string[]>>;
  claim(id: string): Promise<void>;
  release(id: string): Promise<void>;
  assign(id: string, target: { user?: string; group?: string }): Promise<void>;
  bulkClaim(ids: string[]): Promise<void>;
  bulkCancel(ids: string[]): Promise<void>;
  setPriority(id: string, priority: string): Promise<void>;
  setDueDate(id: string, iso: string): Promise<void>;
  complete(id: string, params: Record<string, unknown>): Promise<void>;
  saveTaskData(id: string, params: Record<string, unknown>): Promise<void>;
  cancelTask(id: string): Promise<void>;
  taskStream(id: string): Promise<StreamItem[]>;
  commentTask(id: string, text: string): Promise<void>;
  followTask(id: string, follow: boolean): Promise<void>;
  isFollowingTask(id: string): Promise<boolean>;
  // launch
  exposedProcesses(): Promise<ExposedProcess[]>;
  processModel(bpdId: string, snapshotId: string): Promise<ProcessModel>;
  startProcess(bpdId: string, snapshotId: string, params: Record<string, unknown>): Promise<{ piid: string; name: string; firstTaskId?: string }>;
  // instances
  searchInstances(filter: InstanceFilter): Promise<InstanceSearchResult>;
  instance(id: string): Promise<InstanceDetails>;
  instanceAction(id: string, action: 'suspend' | 'resume' | 'terminate' | 'retry' | 'delete'): Promise<void>;
  setInstanceDueDate(id: string, iso: string): Promise<void>;
  commentInstance(id: string, text: string): Promise<void>;
  instanceStream(id: string): Promise<StreamItem[]>;
  followInstance(id: string, follow: boolean): Promise<void>;
  isFollowingInstance(id: string): Promise<boolean>;
  statusOverview(): Promise<StatusOverview>;
  // saved searches
  savedSearches(): Promise<SavedSearch[]>;
  saveSearch(search: { id?: string; name: string; description?: string; shared: boolean; filter: TaskFilter }): Promise<SavedSearch>;
  deleteSearch(id: string): Promise<void>;
  // notifications
  mentions(): Promise<StreamItem[]>;
}

export const BPM_API = new InjectionToken<BpmApi>('BPM_API');
export function apiFactory(): BpmApi { return environment.mode === 'demo' ? inject(StubApi) : inject(LiveApi); }
