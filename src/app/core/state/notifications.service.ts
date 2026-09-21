import { Injectable, computed, inject, signal } from '@angular/core';
import { BPM_API } from '../api/bpm-api';
import { Notification } from '../api/models';

/** Notifications derived from the engine: overdue / due today / at-risk tasks of the user, newly assigned tasks, mentions. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(BPM_API);
  readonly items = signal<Notification[]>([]);
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly count = computed(() => this.items().length);
  private seen = new Set<string>();

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [tasks, mentions] = await Promise.all([this.api.searchTasks({ scope: 'mine', size: 200, sort: 'taskDueDate', sortDir: 'asc' }), this.api.mentions().catch(() => [])]);
      const now = Date.now(); const today = new Date().toDateString(); const out: Notification[] = [];
      for (const t of tasks.rows) {
        const due = t.dueDate ? new Date(t.dueDate) : null; const link = `/task/${t.taskId}`;
        if (due && due.getTime() < now) out.push({ id: 'overdue-' + t.taskId, kind: 'overdue', title: t.subject, detail: `Overdue since ${due.toLocaleString()} - ${t.instanceName}`, when: t.dueDate, link });
        else if (due && due.toDateString() === today) out.push({ id: 'today-' + t.taskId, kind: 'due-today', title: t.subject, detail: `Due today at ${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${t.instanceName}`, when: t.dueDate, link });
        else if (t.isAtRisk) out.push({ id: 'risk-' + t.taskId, kind: 'at-risk', title: t.subject, detail: `At risk - ${t.instanceName}`, when: t.dueDate, link });
        if (!this.seen.has(String(t.taskId)) && this.seen.size > 0) out.push({ id: 'new-' + t.taskId, kind: 'assigned', title: t.subject, detail: `New in your list - ${t.instanceName}`, when: t.created, link });
      }
      for (const t of tasks.rows) this.seen.add(String(t.taskId));
      for (const m of mentions) out.push({ id: 'mention-' + m.published, kind: 'mention', title: m.actor?.displayName ?? 'Mention', detail: m.content.replace(/<[^>]+>/g, ''), when: m.published, link: m.object?.id ? `/task/${m.object.id}` : '/work' });
      this.items.set(out);
    } finally { this.loading.set(false); }
  }
  dismiss(id: string) { this.items.update(list => list.filter(n => n.id !== id)); }
}
