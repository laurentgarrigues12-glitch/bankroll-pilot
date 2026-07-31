import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BankrollChart } from './BankrollChart';

describe('BankrollChart', () => {
  it('renders the chart when data is available', () => {
    render(<BankrollChart data={[{ date: '2026-07-30', bankroll: 125, dailyResult: 5 }]} />);
    expect(screen.getByLabelText('Évolution de la bankroll')).not.toBeNull();
  });

  it('renders the empty state without data', () => {
    render(<BankrollChart data={[]} state="empty" />);
    expect(screen.getByText('Aucune donnée de bankroll à afficher.')).not.toBeNull();
  });

  it('renders loading and error states', () => {
    const { rerender } = render(<BankrollChart data={[]} state="loading" />);
    expect(screen.getByText('Chargement des données…')).not.toBeNull();
    rerender(<BankrollChart data={[]} state="error" />);
    expect(screen.getByRole('alert').textContent).toContain('Le graphique est indisponible pour le moment.');
  });
});
