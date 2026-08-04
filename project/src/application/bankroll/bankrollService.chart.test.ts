import { describe, expect, it } from 'vitest';
import { bankrollService } from './bankrollService';

describe('bankrollService.createChartSeries', () => {
  it('includes the initial bankroll and older Winamax results in chronological order', () => {
    const series = bankrollService.createChartSeries(
      { id: 'current', initialBankrollCents: 10000, currency: 'EUR', startDate: '2026-07-01' },
      [],
      [
        { id: 'winamax:tournament:second', type: 'adjustment', amountCents: 2000, date: '2026-07-27', comment: '', createdAt: '' },
        { id: 'tournament:1155831676:maltau', type: 'adjustment', amountCents: -1000, date: '2026-07-25', comment: '', createdAt: '', sourceId: 'tournament:1155831676:maltau' },
      ],
    );

    expect(series).toEqual([
      { date: '2026-07-01', bankroll: 100, dailyResult: 0 },
      { date: '2026-07-25', bankroll: 90, dailyResult: -10 },
      { date: '2026-07-27', bankroll: 110, dailyResult: 20 },
    ]);
  });
});
