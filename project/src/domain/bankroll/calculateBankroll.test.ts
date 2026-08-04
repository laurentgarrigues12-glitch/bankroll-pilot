import { describe, expect, it } from 'vitest';
import { calculateBankroll } from './calculateBankroll';

describe('calculateBankroll', () => {
  it('keeps withdrawals and expenses outside poker results', () => {
    const result = calculateBankroll({ id: 'current', initialBankrollCents: 10000, currency: 'EUR', startDate: '2026-07-01' }, [{ handId: 'h1', playedAt: '2026-07-30T10:00:00.000Z', netResultCents: 250 } as never], [{ id: '1', type: 'deposit', amountCents: 1000, date: '2026-07-30', comment: '', createdAt: '' }, { id: '2', type: 'withdrawal', amountCents: 400, date: '2026-07-30', comment: '', createdAt: '' }, { id: '3', type: 'expense', amountCents: 200, date: '2026-07-30', comment: '', createdAt: '' }], new Date('2026-07-30T12:00:00.000Z'));
    expect(result).toMatchObject({ currentCents: 10650, pokerTodayCents: 250, depositMonthCents: 1000, withdrawalMonthCents: 400 });
  });

  it('includes signed Winamax tournament adjustments in poker statistics and bankroll', () => {
    const operations = [
      { id: 'winamax:tournament:loss', type: 'adjustment' as const, amountCents: -1000, date: '2026-07-30', comment: '', createdAt: '' },
      { id: 'winamax:tournament:win', type: 'adjustment' as const, amountCents: 2000, date: '2026-07-30', comment: '', createdAt: '' },
    ];
    const result = calculateBankroll({ id: 'current', initialBankrollCents: 10000, currency: 'EUR', startDate: '2026-07-01' }, [], operations, new Date('2026-07-30T12:00:00.000Z'));
    expect(result).toMatchObject({ currentCents: 11000, pokerTodayCents: 1000, pokerMonthCents: 1000, pokerTotalCents: 1000 });
  });

  it('counts Winamax results once while keeping manual adjustments outside poker metrics', () => {
    const settings = { id: 'current' as const, initialBankrollCents: 10000, currency: 'EUR' as const, startDate: '2026-07-01' };
    const today = new Date('2026-07-30T12:00:00.000Z');
    const loss = { id: 'winamax:tournament:test:hero', type: 'adjustment' as const, amountCents: -1000, date: '2026-07-30', comment: '', createdAt: '' };
    expect(calculateBankroll(settings, [], [loss], today)).toMatchObject({ currentCents: 9000, pokerTodayCents: -1000, pokerMonthCents: -1000, pokerTotalCents: -1000 });
    const win = { id: 'winamax:tournament:test:hero-2', type: 'adjustment' as const, amountCents: 2000, date: '2026-07-30', comment: '', createdAt: '' };
    const manual = { id: 'manual-adjustment', type: 'adjustment' as const, amountCents: 500, date: '2026-07-30', comment: '', createdAt: '' };
    expect(calculateBankroll(settings, [], [loss, win, manual], today)).toMatchObject({ currentCents: 11500, pokerTodayCents: 1000, pokerMonthCents: 1000, pokerTotalCents: 1000 });
  });

  it('keeps an older Winamax tournament out of today while including it in month, total, and bankroll', () => {
    const result = calculateBankroll(
      { id: 'current', initialBankrollCents: 10000, currency: 'EUR', startDate: '2026-07-01' },
      [],
      [{ id: 'winamax:tournament:older-result', type: 'adjustment', amountCents: -1000, date: '2026-07-25', comment: '', createdAt: '' }],
      new Date('2026-07-30T12:00:00.000Z'),
    );
    expect(result).toMatchObject({ currentCents: 9000, pokerTodayCents: 0, pokerMonthCents: -1000, pokerTotalCents: -1000 });
  });

  it('uses the local calendar day for signed poker results and excludes non-poker movements', () => {
    const settings = { id: 'current' as const, initialBankrollCents: 10000, currency: 'EUR' as const, startDate: '2026-07-01' };
    const reference = new Date(2026, 6, 30, 23, 59, 59);
    const operations = [
      { id: 'winamax:tournament:today-loss', type: 'adjustment' as const, amountCents: -1000, date: '2026-07-30', comment: '', createdAt: '' },
      { id: 'winamax:tournament:today-win', type: 'adjustment' as const, amountCents: 2000, date: '2026-07-30', comment: '', createdAt: '' },
      { id: 'winamax:tournament:yesterday', type: 'adjustment' as const, amountCents: 700, date: '2026-07-29', comment: '', createdAt: '' },
      { id: 'deposit', type: 'deposit' as const, amountCents: 5000, date: '2026-07-30', comment: '', createdAt: '' },
      { id: 'withdrawal', type: 'withdrawal' as const, amountCents: 2000, date: '2026-07-30', comment: '', createdAt: '' },
      { id: 'manual-adjustment', type: 'adjustment' as const, amountCents: 300, date: '2026-07-30', comment: '', createdAt: '' },
    ];
    const snapshot = calculateBankroll(settings, [], operations, reference);
    expect(snapshot).toMatchObject({ pokerTodayCents: 1000, pokerMonthCents: 1700, pokerTotalCents: 1700 });
    expect(calculateBankroll(settings, [], operations, new Date(2026, 7, 1, 0, 0, 1))).toMatchObject({ pokerTodayCents: 0, pokerMonthCents: 0 });
  });

  it('includes a legacy Winamax operation while excluding a manual adjustment from poker metrics', () => {
    const result = calculateBankroll(
      { id: 'current', initialBankrollCents: 10000, currency: 'EUR', startDate: '2026-07-01' },
      [],
      [
        { id: 'tournament:1155831676:maltau', type: 'adjustment', amountCents: -1000, date: '2026-07-25', comment: '', createdAt: '', sourceId: 'tournament:1155831676:maltau' },
        { id: 'winamax:tournament:1155831677:maltau', type: 'adjustment', amountCents: 2000, date: '2026-07-27', comment: '', createdAt: '', source: 'winamax', sourceId: 'tournament:1155831677:maltau' },
        { id: 'manual-adjustment', type: 'adjustment', amountCents: 500, date: '2026-07-30', comment: '', createdAt: '' },
      ],
      new Date('2026-07-30T12:00:00.000Z'),
    );
    expect(result).toMatchObject({ currentCents: 11500, pokerTodayCents: 0, pokerMonthCents: 1000, pokerTotalCents: 1000 });
  });
});
