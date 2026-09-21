import { Pipe, PipeTransform } from '@angular/core';

/** "in 2 h", "3 d ago", "just now" for an ISO timestamp. */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    const diff = new Date(value).getTime() - Date.now(); const abs = Math.abs(diff); const past = diff < 0;
    const units: [number, string][] = [[60000, 'min'], [3600000, 'h'], [86400000, 'd'], [604800000, 'wk'], [2592000000, 'mo'], [31536000000, 'y']];
    if (abs < 60000) return 'just now';
    let text = '';
    for (let i = units.length - 1; i >= 0; i--) { if (abs >= units[i][0]) { text = Math.round(abs / units[i][0]) + ' ' + units[i][1]; break; } }
    return past ? `${text} ago` : `in ${text}`;
  }
}
