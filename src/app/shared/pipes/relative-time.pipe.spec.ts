import { describe, expect, it } from 'vitest';
import { RelativeTimePipe } from './relative-time.pipe';
import { PriorityClassPipe } from './priority.pipe';

describe('RelativeTimePipe', () => {
  const p = new RelativeTimePipe();
  it('formats past and future', () => {
    expect(p.transform(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('3 h ago');
    expect(p.transform(new Date(Date.now() + 2 * 86400000).toISOString())).toBe('in 2 d');
    expect(p.transform(new Date().toISOString())).toBe('just now'); expect(p.transform(null)).toBe('');
  });
});
describe('PriorityClassPipe', () => { it('maps priorities to chip classes', () => { const p = new PriorityClassPipe(); expect(p.transform('High')).toBe('warn'); expect(p.transform('Highest')).toBe('danger'); expect(p.transform('Normal')).toBe(''); expect(p.transform('Low')).toBe('neutral'); }); });
