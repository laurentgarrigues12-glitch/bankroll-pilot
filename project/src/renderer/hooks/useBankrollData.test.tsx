import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bankrollService } from '../../application/bankroll/bankrollService';
import { bankrollDatabase } from '../../infrastructure/storage/bankrollDatabase';
import { useBankrollData } from './useBankrollData';

const toLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('useBankrollData', () => {
  beforeEach(async () => {
    localStorage.setItem('bankroll-pilot.access.local.v1', JSON.stringify({ active: true }));
    for (const operation of await bankrollDatabase.getOperations()) await bankrollDatabase.deleteOperation(operation.id);
    const now = new Date();
    await bankrollDatabase.saveSettings({
      id: 'current',
      initialBankrollCents: 10000,
      currency: 'EUR',
      startDate: toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    });
  });

  it('reloads persisted Winamax results after refresh', async () => {
    const hook = renderHook(() => useBankrollData());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const today = toLocalDate(new Date());
    await bankrollService.importWinamaxOperations([{ type: 'adjustment', amountCents: -1000, date: today, comment: 'Loss', importKey: 'tournament:refresh:loss' }]);
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.data?.snapshot).toMatchObject({ currentCents: 9000, pokerTodayCents: -1000, pokerMonthCents: -1000, pokerTotalCents: -1000 });
    await bankrollService.importWinamaxOperations([{ type: 'adjustment', amountCents: 2000, date: today, comment: 'Win', importKey: 'tournament:refresh:win' }]);
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.data?.snapshot).toMatchObject({ currentCents: 11000, pokerTodayCents: 1000, pokerMonthCents: 1000, pokerTotalCents: 1000 });
    expect(bankrollService.createChartSeries(hook.result.current.data!.settings!, [], hook.result.current.data!.operations).at(-1)).toMatchObject({ bankroll: 110, dailyResult: 10 });
  });

  it('refreshes poker results when the local day changes', async () => {
    const load = vi.spyOn(bankrollService, 'load').mockImplementation(async () => ({
      settings: { id: 'current' as const, initialBankrollCents: 10000, currency: 'EUR' as const, startDate: '2026-07-01' },
      snapshot: { currentCents: 9000, pokerTodayCents: new Date().getDate() === 29 ? -1000 : 0, pokerMonthCents: -1000, depositMonthCents: 0, withdrawalMonthCents: 0, pokerTotalCents: -1000 },
      hands: [],
      operations: [],
    }));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29, 23, 59, 59));
    try {
      const hook = renderHook(() => useBankrollData());
      await act(async () => { await hook.result.current.refresh(); });
      expect(hook.result.current.data?.snapshot?.pokerTodayCents).toBe(-1000);
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(hook.result.current.data?.snapshot?.pokerTodayCents).toBe(0);
      expect(hook.result.current.data?.snapshot?.pokerMonthCents).toBe(-1000);
    } finally {
      load.mockRestore();
      vi.useRealTimers();
    }
  });

  afterEach(() => vi.useRealTimers());
});
