import { Pipe, PipeTransform } from '@angular/core';
/** Priority name -> chip class. */
@Pipe({ name: 'priorityClass' })
export class PriorityClassPipe implements PipeTransform {
  transform(p: string | null | undefined): string { return { Highest: 'danger', High: 'warn', Normal: '', Low: 'neutral', Lowest: 'neutral' }[p ?? ''] ?? ''; }
}
