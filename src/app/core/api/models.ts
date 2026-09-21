/** Data model of the portal - shaped after the classic Process REST API (rest/bpm/wle/v1) of BAW 8.6.2, normalised for the UI. */
export interface CurrentUser { userID: number; userName: string; fullName: string; emailAddress: string | null; memberships: string[]; userPreferences: Record<string, string>; editableUserPreferences: string[]; }
export interface UserSummary { userID: number; userName: string; fullName: string; emailAddress: string | null; }
export interface GroupSummary { groupID: number; groupName: string; displayName: string; description: string; members: string[]; }
export type TaskStatus = 'Received' | 'Replied' | 'Forwarded' | 'Sent' | 'New' | 'Special' | 'Closed' | string;
export type Priority = 'Highest' | 'High' | 'Normal' | 'Low' | 'Lowest';
/** One row of a task search (PUT /search/query, organization byTask). */
export interface TaskRow {
  taskId: number; subject: string; status: TaskStatus; priority: Priority; dueDate: string | null; assignedTo: string | null; assignedType: 'User' | 'Group' | null;
  instanceId: number; instanceName: string; processName: string; appAcronym: string; instanceStatus: string; instanceDueDate: string | null; created: string | null; isAtRisk?: boolean;
  /** searchable business data of the instance (alias -> value), the columns Process Portal showed in its task list */
  businessData?: Record<string, string>;
}
export interface TaskSearchResult { rows: TaskRow[]; totalCount: number; offset: number; size: number; }
/** Filters of the Work list (translated into search conditions by the API layer). */
export interface TaskFilter { scope: 'mine' | 'team' | 'all' | 'closed'; statuses?: TaskStatus[]; priorities?: Priority[]; due?: 'overdue' | 'today' | 'week' | 'any'; text?: string; app?: string; process?: string; user?: string; sort?: string; sortDir?: 'asc' | 'desc'; offset?: number; size?: number; }
export interface TaskStats { total: number; onTrack: number; atRisk: number; overdue: number; byPriority: Record<string, number>; byStatus: Record<string, number>; }
/** GET /task/{id}?parts=all */
export interface TaskDetails {
  tkiid: string; name: string; displayName: string; description: string; status: TaskStatus; state: string; priority: number; priorityName: Priority; dueTime: string | null; atRiskTime: string | null; isAtRisk: boolean;
  activationTime: string; startTime: string | null; completionTime: string | null; lastModificationTime: string; originator: string; owner: string | null; assignedTo: string | null; assignedToDisplayName: string | null; assignedToType: string | null;
  piid: string; processInstanceName: string; teamDisplayName: string | null; teamName: string | null; teamID: number | null; managerTeamDisplayName: string | null;
  data: { variables: Record<string, unknown> }; actions: string[] | null; serviceType: string; collaboration?: { status: boolean; currentUsers: string[] }; closeByUser?: string | null; closeByUserFullName?: string | null;
}
/** Headless form contract carried in the task data (business object HeadlessForm of the sample application). */
export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';
export interface FormField { name: string; label: string; type: FieldType; required: boolean; options: string; value: string; help: string; }
export interface HeadlessForm { title: string; description: string; fields: FormField[]; }
export interface ExposedProcess { itemID: string; display: string; processAppID: string; processAppName: string; processAppAcronym: string; snapshotID: string; snapshotName: string; branchID: string; tip: boolean; isDefault: boolean; startURL: string; }
export interface ProcessInput { name: string; type: string; isList: boolean; classId: string; }
export interface ProcessModel { name: string; description: string; inputs: ProcessInput[]; steps: DiagramStep[]; }
export interface DiagramStep { ID: string; name: string; type: string; activityType?: string | null; lane: string | null; x: number; y: number; lines: { to: string; name: string; tokenID?: string | null }[]; tokenID?: string | null; taskID?: string | null; }
/** One row of an instance search. */
export interface InstanceRow { instanceId: number; name: string; processName: string; appAcronym: string; status: string; created: string | null; modified: string | null; dueDate: string | null; }
export interface InstanceSearchResult { rows: InstanceRow[]; totalCount: number; offset: number; size: number; }
export interface InstanceFilter { statuses?: string[]; text?: string; app?: string; process?: string; involvedOnly?: boolean; sort?: string; sortDir?: 'asc' | 'desc'; offset?: number; size?: number; }
/** GET /process/{id}?parts=all */
export interface InstanceDetails {
  piid: string; name: string; description: string; executionState: string; state: string; creationTime: string; lastModificationTime: string; dueDate: string | null; processTemplateName: string; processTemplateID: string;
  processAppName: string; processAppAcronym: string; processAppID: string; snapshotName: string; snapshotID: string; branchID: string; tasks: TaskDetails[]; variables: Record<string, unknown>; comments: InstanceComment[];
  diagram: DiagramStep[]; tokens: TokenInfo[]; actions: string[]; documents?: unknown[];
}
export interface InstanceComment { id: string; author: string; created: string; text: string; }
export interface TokenInfo { tokenId: string; name: string; flowObjectId: string; taskIds: string[]; }
export interface StreamItem { verb: string; published: string; actor: { displayName?: string; id?: string }; content: string; object?: { displayName?: string; objectType?: string; id?: string }; }
export interface SavedSearch { id: string; name: string; description?: string; shared: boolean; owner?: string; definition: unknown; }
export interface StatusOverview { Active: number; Failed: number; Completed: number; Terminated: number; Did_not_Start: number; Suspended: number; }
export interface TeamInfo { name: string; displayName: string; members: string[]; managers?: string; description?: string; }
export interface Notification { id: string; kind: 'overdue' | 'due-today' | 'at-risk' | 'assigned' | 'mention'; title: string; detail: string; when: string | null; link: string; }
