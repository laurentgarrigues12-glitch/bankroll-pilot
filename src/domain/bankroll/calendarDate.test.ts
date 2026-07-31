import { describe, expect, it } from 'vitest';
import { calendarDateFor, toCalendarDate } from './calendarDate';

describe('calendar dates', () => {
  it('keeps date-only operations unchanged and groups ISO timestamps by local calendar day', () => {
    expect(toCalendarDate('2026-07-30')).toBe('2026-07-30');
    expect(calendarDateFor(new Date(2026, 6, 30, 0, 30))).toBe('2026-07-30');
  });
});
