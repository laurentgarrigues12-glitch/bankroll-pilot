import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./hooks/useBankrollData', () => ({
  useBankrollData: () => ({
    data: {
      settings: {
        id: 'current' as const,
        initialBankrollCents: 10000,
        currency: 'EUR' as const,
        startDate: '2026-07-01',
      },
      snapshot: {
        currentCents: 12500,
        pokerTodayCents: 500,
        pokerMonthCents: 2500,
        depositMonthCents: 1000,
        withdrawalMonthCents: 200,
        pokerTotalCents: 2500,
      },
      hands: [],
      operations: [],
    },
    loading: false,
    error: null,
    refresh: mocks.refresh,
  }),
}));

vi.mock('./hooks/useAccessStatus', () => ({
  useAccessStatus: () => ({
    access: { status: 'trial', trialStartedAt: '2026-07-01T00:00:00.000Z', trialExpiresAt: '2026-07-04T00:00:00.000Z', remainingMilliseconds: 1, canRead: true, canWrite: true, canImport: true, canRestore: true, canExport: true, lastCheckedAt: '2026-07-01T00:00:00.000Z' },
    loading: false,
    error: null,
    refresh: mocks.refresh,
    startTrial: mocks.refresh,
  }),
}));

import { App } from './App';

describe('App', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts the real dashboard with its current metrics', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 12, 0, 0));

    render(<App />);

    expect(screen.getByText('31/07/2026')).not.toBeNull();
    expect(screen.getByText('Bankroll actuelle')).not.toBeNull();
    expect(screen.getByText('Résultat du jour')).not.toBeNull();
    expect(screen.getByText('Résultat du mois')).not.toBeNull();
    expect(screen.getByText('Dépôt du mois')).not.toBeNull();
    expect(screen.getByText('Retraits du mois')).not.toBeNull();
    expect(screen.getByRole('table')).not.toBeNull();
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
    expect(headers.map((header) => header.textContent)).toEqual([
      'Date',
      'Dépôt du mois',
      'Retraits du mois',
      'Résultat du mois',
      'Résultat du jour',
      'Bankroll actuelle',
    ]);
    expect(screen.getByRole('columnheader', { name: 'Bankroll actuelle' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Résultat du jour' })).not.toBeNull();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.queryByText('Données de démonstration')).toBeNull();
  });

  it('opens the settings page through the existing navigation', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));

    expect(screen.getByRole('heading', { name: 'Bankroll initiale' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).not.toBeNull();
  });
});
