import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessState } from '../domain/access/types';

const access = (status: AccessState['status']): AccessState => ({
  status, trialStartedAt: status === 'trial' || status === 'expired' ? '2026-01-01T00:00:00.000Z' : null, trialExpiresAt: status === 'trial' || status === 'expired' ? '2026-01-04T00:00:00.000Z' : null, remainingMilliseconds: status === 'trial' ? 1 : 0,
  canRead: true, canWrite: status === 'trial' || status === 'active', canImport: status === 'trial' || status === 'active', canRestore: status === 'trial' || status === 'active', canExport: true, lastCheckedAt: '2026-01-01T00:00:00.000Z',
});
const state = vi.hoisted(() => ({ current: null as AccessState | null, startTrial: vi.fn(), simulate: vi.fn(), refresh: vi.fn() }));

vi.mock('./hooks/useAccessStatus', () => ({ useAccessStatus: () => ({ access: state.current, loading: false, error: null, startTrial: state.startTrial, simulate: state.simulate, refresh: state.refresh }) }));
vi.mock('./hooks/useBankrollData', () => ({ useBankrollData: () => ({ data: { settings: { id: 'current', initialBankrollCents: 10000, currency: 'EUR', startDate: '2026-01-01' }, snapshot: { currentCents: 11000, pokerTodayCents: 0, pokerMonthCents: 0, depositMonthCents: 0, withdrawalMonthCents: 0, pokerTotalCents: 0 }, hands: [], operations: [] }, loading: false, error: null, refresh: vi.fn() }) }));

import { App } from './App';
import { SettingsPage } from './pages/SettingsPage';

describe('Access states in the application UI', () => {
  beforeEach(() => {
    state.current = access('trial');
    state.startTrial.mockReset();
    state.simulate.mockReset();
    state.refresh.mockReset();
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, writable: true, value: vi.fn() });
  });

  it('shows the welcome screen and starts trial only after explicit click', () => {
    state.current = access('not_started'); state.startTrial.mockImplementation(() => { state.current = access('trial'); return Promise.resolve(); });
    const view = render(<App />);
    expect(screen.getByText('BÊTA PRIVÉE')).not.toBeNull();
    expect(screen.getByText('Testez Bankroll Pilot gratuitement')).not.toBeNull();
    expect(screen.getByText(/3 joueurs maximum/)).not.toBeNull();
    expect(screen.getByText('3 places maximum')).not.toBeNull();
    expect(screen.getByText('Suivi de votre bankroll')).not.toBeNull();
    expect(screen.getByText('Gestion des dépôts et retraits')).not.toBeNull();
    expect(screen.getByText('Import de fichiers Winamax')).not.toBeNull();
    expect(screen.getByText('Graphique d’évolution')).not.toBeNull();
    expect(screen.getByText('Sauvegarde et restauration de vos données')).not.toBeNull();
    expect(screen.getByText('Aucune carte bancaire demandée')).not.toBeNull();
    expect(screen.getByText('Données enregistrées localement dans le navigateur')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Commencer la bêta gratuite' }));
    expect(state.startTrial).toHaveBeenCalledOnce();
    view.rerender(<App />);
    expect(screen.queryByText('Testez Bankroll Pilot gratuitement')).toBeNull();
    expect(screen.getByText('Essai gratuit en cours')).not.toBeNull();
  });

  it('keeps full application actions available during an active trial', () => {
    render(<App />);
    expect(screen.getByText('Essai gratuit en cours')).not.toBeNull();
    expect(screen.getByText('Bankroll actuelle')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Opérations' }));
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Import Winamax' }));
    expect((screen.getByRole('button', { name: /Choisir le dossier Winamax/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps data readable but disables writes after expiration', () => {
    state.current = access('expired'); render(<App />);
    expect(screen.getByText('Votre période d’essai est terminée')).not.toBeNull();
    expect(screen.getByText('Bankroll actuelle')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Opérations' }));
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Mode lecture seule/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Import Winamax' }));
    expect((screen.getByRole('button', { name: /Choisir le dossier Winamax/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Sauvegarder mes données/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /Restaurer une sauvegarde/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not show restrictions for active access', () => {
    state.current = access('active'); render(<App />);
    expect(screen.queryByText('Votre période d’essai est terminée')).toBeNull();
    expect(screen.queryByText('Essai gratuit en cours')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows unavailable access as read-only without clearing dashboard data', () => {
    state.current = access('unavailable'); render(<App />);
    expect(screen.getByText('Service d’accès indisponible')).not.toBeNull();
    expect(screen.getByText('Bankroll actuelle')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Opérations' }));
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders development simulations only through the access hook', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(screen.getByRole('heading', { name: 'Outils de développement' })).not.toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Simuler essai expiré' })); });
    expect(state.simulate).toHaveBeenCalledWith('expired');
  });

  it('does not render development commands when no development API is supplied', () => {
    render(<SettingsPage onSaved={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.queryByRole('heading', { name: 'Outils de développement' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Simuler essai actif' })).toBeNull();
  });
});
