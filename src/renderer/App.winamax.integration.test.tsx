import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { bankrollDatabase } from '../infrastructure/storage/bankrollDatabase';
import { bankrollService } from '../application/bankroll/bankrollService';
import { App } from './App';

const accessStorageKey = 'bankroll-pilot.access.local.v1';

const metricValue = (label: string): HTMLElement => {
  const headers = screen.getAllByRole('columnheader');
  const columnIndex = headers.findIndex((header) => header.textContent === label);

  if (columnIndex === -1) {
    throw new Error(`Metric header not found: ${label}`);
  }

  const values = screen.getAllByRole('cell');
  const value = values[columnIndex];

  if (value === undefined) {
    throw new Error(`Metric value not found: ${label}`);
  }

  return value;
};

describe('App Winamax import integration', () => {
  beforeEach(async () => {
    localStorage.setItem(accessStorageKey, JSON.stringify({ active: true }));

    await bankrollDatabase.replaceBackupData({
      settings: {
        id: 'current',
        initialBankrollCents: 10000,
        currency: 'EUR',
        startDate: '2026-07-01',
      },
      operations: [],
      hands: [],
      imports: [],
    });
  });

  it('loads the real dashboard after a persisted older Winamax import', async () => {
    const currentDate = new Date().toISOString().slice(0, 10);
    await expect(
      bankrollService.importWinamaxOperations([
        {
          type: 'adjustment',
          amountCents: 1000,
          date: currentDate,
          comment: 'Résultat Winamax',
          importKey: 'tournament:dashboard-integration:hero',
        },
      ]),
    ).resolves.toEqual({
      importedCount: 1,
      duplicateCount: 0,
    });

    expect(await bankrollDatabase.getOperations()).toEqual([
      expect.objectContaining({
        id: 'winamax:tournament:dashboard-integration:hero',
        type: 'adjustment',
        amountCents: 1000,
        date: currentDate,
        source: 'winamax',
        sourceId: 'tournament:dashboard-integration:hero',
      }),
    ]);

    expect(await bankrollService.inspectWinamaxOperations()).toEqual([
      expect.objectContaining({
        type: 'adjustment',
        amountCents: 1000,
        date: currentDate,
        source: 'winamax',
        sourceId: 'tournament:dashboard-integration:hero',
      }),
    ]);

    render(<App />);

    await screen.findByText('Bankroll actuelle');

    await waitFor(() => {
      expect(metricValue('Bankroll actuelle').textContent).toContain('110');
      expect(metricValue('Résultat du jour').textContent).toContain('0');
      expect(metricValue('Résultat du mois').textContent).toContain('10');
    });

    expect(screen.getByLabelText('Évolution de la bankroll')).not.toBeNull();
  });
});
