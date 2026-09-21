import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
Chart.register(...registerables);

/** Chart.js wrapper: re-renders when the configuration input changes; follows the theme colors. */
@Component({ selector: 'hp-chart', template: '<canvas #c></canvas>', styles: [':host { display: block; position: relative; height: 240px; }'] })
export class ChartComponent implements AfterViewInit, OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('c');
  private chart?: Chart;
  constructor() { effect(() => { const c = this.config(); if (this.chart) { this.chart.data = c.data; this.chart.options = { ...this.baseOptions(), ...(c.options ?? {}) }; this.chart.update(); } }); }
  ngAfterViewInit() { const c = this.config(); this.chart = new Chart(this.canvas().nativeElement, { ...c, options: { ...this.baseOptions(), ...(c.options ?? {}) } }); }
  ngOnDestroy() { this.chart?.destroy(); }
  private baseOptions() { const text = getComputedStyle(document.documentElement).getPropertyValue('--hp-text') || '#333'; const grid = getComputedStyle(document.documentElement).getPropertyValue('--hp-border') || '#ddd'; return { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: text } } }, scales: { x: { ticks: { color: text }, grid: { color: grid } }, y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true } } }; }
}
export const PALETTE = ['#2f6feb', '#7c3aed', '#0f9d58', '#f5a623', '#d64545', '#0ea5e9', '#9333ea', '#64748b'];
