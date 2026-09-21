# Endpoints per function (classic Process REST API v1, verified on BAW 8.6.2)

Base path `/rest/bpm/wle/v1` (environment `restBase`). Every call carries `Authorization: Basic` (see SECURITY.md). Answers are
`{status, data}`; failures `{status: "error", Data: {errorNumber, errorMessage}}` (shown by `errorText()`).

| Function | Method and path | Notes |
|---|---|---|
| Sign-in / current user | `GET /user/current?includeEditableUserPreferences=true` | 401 = wrong credentials; answer: userID, userName, fullName, emailAddress, memberships[], userPreferences, editableUserPreferences |
| Avatar | `GET /avatar/current`, `GET /avatar/{user}`, `POST /avatar/current` (multipart), `DELETE /avatar/current` | image, or a JSON stub when none |
| Preferences | `PUT /user/{user}?action=setPreferences&prefs={json}` | keys from editableUserPreferences |
| Directory | `GET /users?filter=pat*&maxresult=`, `GET /groups?filter=pat*` | team groups are named `Team_T_<uuid>.<snapshot>`; the Teams page groups them by display name |
| Task list (Work, Search, dashboards, notifications) | `PUT /search/query?organization=byTask&columns=...&condition=col\|op\|value&condition=...&sort=col&size=500&offset=n[&filterByCurrentUser=true]` | columns: taskId, taskSubject, taskStatus, taskPriority, taskDueDate, taskReceivedDate, taskClosedDate, taskIsAtRisk, taskAtRiskTime, taskActivityName, assignedToUser, assignedToRole, assignedToRoleDisplayName, taskReceivedFrom, instanceId, instanceName, bpdName, bpdId, instanceStatus, instanceCreateDate, instanceModifyDate, instanceDueDate, instanceProcessApp, instanceSnapshot, instanceSnapshotId. Operators: Equals, NotEquals, Contains, StartsWith, GreaterThan, LessThan. Special values: taskStatus `New_or_Received`, `Closed`, `Alert`. Repeated `condition` = AND. Sort ascending only; max size 500; `filterByCurrentUser=true` restricts to the user's own and team tasks. |
| Instance list | same resource with `organization=byInstance` | instanceStatus Active / Completed / Failed / Suspended / Terminated |
| Task details | `GET /task/{id}?parts=all` | data.variables (lists as {selected, items}, business objects with @metadata), actions, team, priorityName, dueTime, assignedTo / assignedToType (lower case `user` / `group` here, capitalised in search rows - normalised by the adapter) |
| Task actions available | `GET /task/actions?taskIDs=a,b` | ACTION_* per task |
| Claim / release / assign | `PUT /task/{id}?action=assign&toMe=true` · `&back=true` · `&toUser=` · `&toGroup=` | |
| Bulk claim / cancel | `PUT /task?action=claim&taskIDs=` · `PUT /task?action=cancel&taskIDs=` | |
| Priority / due date | `PUT /task/{id}?action=update&priority=High` · `&dueDate=ISO` | |
| Complete (headless form) | `PUT /task/{id}?action=complete&params={json}` | params = task output variables; the engine assigns the task to the caller if needed |
| Save draft | `PUT /task/{id}?action=setData&params={json}` | |
| Cancel task | `PUT /task/{id}?action=cancel` | |
| Task collaboration | `GET /social/task/{id}/stream` (shows the instance-level activity), `GET/POST/DELETE /social/task/{id}/following` | `POST /social/task/{id}/comment?message=` answers `{posted: true}` but the comment appears in no stream on 8.6.2 - the portal posts a task comment as an **instance comment** (`POST /process/{piid}?action=comment&comment=[task name] text`), which both streams show |
| Launch list | `GET /exposed/process` | items with itemID (BPD), snapshotID, branchID, tip, startURL |
| Start form | `GET /processModel/{bpdId}?snapshotId=` | DataModel.inputs {name: {type, isList, classId}} -> generated form |
| Start process | `POST /process?action=start&bpdId=&branchId=(tip)\|snapshotId=&params={json}&parts=all` | on Process Center a tip is started by branchId (snapshotId answers CWTBG0586E) |
| Instance details | `GET /process/{id}?parts=all` | tasks[], variables, executionTree (tokens), diagram.step[] (x, y, lines), comments[], dueDate |
| Instance actions | `GET /process/{id}/actions`; `PUT /process/{id}?action=suspend\|resume\|retry`, `POST ...?action=terminate`, `DELETE /process/{id}`, `PUT ...?action=update&dueDate=`, `POST ...?action=comment&comment=` | |
| Instance collaboration | `GET /social/instance/{id}/stream`, `GET/POST/DELETE /social/instance/{id}/following` | |
| Status overview | `GET /processes/status/overview` | counts per state |
| Saved searches | `GET /searches/tasks`, `GET/PUT/DELETE /searches/tasks/{id}`, `POST /searches/tasks` | definition {name, organization, shared, teams, size, interaction, fields[], aliases[], sort[{field, order}], conditions[{field, operator, value}]}; the portal executes a definition through the search query (same fields) |
| Mentions (notifications) | `GET /social/instances/mentions` | |

CP4BA: the same classic resources are served (role limits apply); the v2 / federated equivalents, the CSRF header and the Zen sign-on are
mapped in docs/CP4BA.md.

Not used (available for later): `GET /tasks?savedSearch=` (execution with attributeInfo / items shape), `PUT /tasks` (ad hoc
definition execution), `/rest/bpm/federated/v1/*` (federated task list with server-side sorting, absent on the 8.6.2 lab),
`/bpm/user-tasks` and `/bpm/processes` (v2), `GET /visual/processModel/instances`, `/performance/query` (PDW).
