import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bankrollService } from '../../application/bankroll/bankrollService';
import type { AccessState } from '../../domain/access/types';
import { SettingsPage } from './SettingsPage';

const writableAccess: AccessState = {
  status: 'active',
  trialStartedAt: null,
  trialExpiresAt: null,
  remainingMilliseconds: 0,
  canRead: true,
  canWrite: true,
  canImport: true,
  canRestore: true,
  canExport: true,
  lastCheckedAt: '2026-07-31T00:00:00.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('SettingsPage bankroll reset', () => {
  it('requires explicit confirmation before resetting and refreshes the application', async () => {
    const reset = vi.spyOn(bankrollService, 'resetBankroll').mockResolvedValue(undefined);
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<SettingsPage settings={{ id: 'current', initialBankrollCents: 25000, currency: 'EUR', startDate: '2026-07-01' }} onSaved={onSaved} access={writableAccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser la bankroll' }));
    expect(reset).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Confirmer la réinitialisation' })).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer la réinitialisation' }));
    });

    expect(reset).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Confirmer la réinitialisation' })).toBeNull();
    expect(screen.getByText('La bankroll a été réinitialisée.')).not.toBeNull();
  });

  it('keeps the reset action unavailable in read-only mode', () => {
    render(<SettingsPage onSaved={vi.fn().mockResolvedValue(undefined)} access={{ ...writableAccess, status: 'expired', canWrite: false, canImport: false, canRestore: false }} />);
    expect((screen.getByRole('button', { name: 'Réinitialiser la bankroll' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
