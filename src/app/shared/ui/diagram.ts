import { Component, computed, input } from '@angular/core';
import { DiagramStep, TokenInfo } from '../../core/api/models';

/** SVG rendering of the process diagram of the engine (GET /process/{id}?parts=all -> diagram.step with x / y / lines) with the
 *  steps that hold a token highlighted. Engine-only: no visual model service needed. */
@Component({
  selector: 'hp-diagram',
  styles: [`:host { display: block; overflow: auto; } svg { font: 12px Inter, system-ui, sans-serif; } .step rect, .step circle, .step polygon { fill: var(--hp-surface); stroke: var(--hp-muted); stroke-width: 1.2; } .step.token rect, .step.token circle, .step.token polygon { stroke: var(--hp-accent); stroke-width: 2.5; fill: color-mix(in srgb, var(--hp-accent) 12%, var(--hp-surface)); } .step text { fill: var(--hp-text); } line { stroke: var(--hp-muted); stroke-width: 1.2; } .lbl { fill: var(--hp-muted); font-size: 10px; }`],
  template: `
    @if (steps().length) {
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [attr.width]="width()" [attr.height]="height()">
        <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--hp-muted)" /></marker></defs>
        @for (l of lines(); track l.key) { <line [attr.x1]="l.x1" [attr.y1]="l.y1" [attr.x2]="l.x2" [attr.y2]="l.y2" marker-end="url(#arr)" /> @if (l.name) { <text class="lbl" [attr.x]="(l.x1 + l.x2) / 2" [attr.y]="(l.y1 + l.y2) / 2 - 4" text-anchor="middle">{{ l.name }}</text> } }
        @for (s of boxes(); track s.ID) {
          <g class="step" [class.token]="s.hasToken" [attr.transform]="'translate(' + s.x + ',' + s.y + ')'">
            @if (s.type === 'event') { <circle [attr.cx]="s.w / 2" [attr.cy]="s.h / 2" r="16" /> }
            @else if (s.type === 'gateway') { <polygon [attr.points]="(s.w / 2) + ',0 ' + s.w + ',' + (s.h / 2) + ' ' + (s.w / 2) + ',' + s.h + ' 0,' + (s.h / 2)" /> }
            @else { <rect [attr.width]="s.w" [attr.height]="s.h" rx="8" /> }
            <text [attr.x]="s.w / 2" [attr.y]="s.type === 'activity' ? s.h / 2 + 4 : s.h + 14" text-anchor="middle">{{ s.name }}</text>
          </g>
        }
      </svg>
    } @else { <div class="hp-muted">No diagram available.</div> }
  `,
})
export class DiagramComponent {
  readonly steps = input<DiagramStep[]>([]); readonly tokens = input<TokenInfo[]>([]);
  readonly boxes = computed(() => { const t = new Set(this.tokens().map(x => x.flowObjectId)); return this.steps().map(s => ({ ...s, w: s.type === 'activity' ? 110 : 36, h: s.type === 'activity' ? 56 : 36, hasToken: t.has(s.ID) || !!s.tokenID })); });
  readonly width = computed(() => Math.max(400, ...this.boxes().map(b => b.x + b.w + 40)));
  readonly height = computed(() => Math.max(160, ...this.boxes().map(b => b.y + b.h + 40)));
  readonly lines = computed(() => { const by = new Map(this.boxes().map(b => [b.ID, b])); const out: { key: string; x1: number; y1: number; x2: number; y2: number; name: string }[] = []; for (const b of this.boxes()) for (const l of b.lines ?? []) { const to = by.get(l.to); if (!to) continue; out.push({ key: b.ID + '>' + l.to, x1: b.x + b.w, y1: b.y + b.h / 2, x2: to.x, y2: to.y + to.h / 2, name: l.name && !/^To /.test(l.name) ? l.name : '' }); } return out; });
}
