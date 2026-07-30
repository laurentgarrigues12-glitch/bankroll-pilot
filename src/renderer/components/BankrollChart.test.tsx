import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BankrollChart } from './BankrollChart';
import { demoBankroll } from '../data/demoBankroll';

describe('BankrollChart', () => {
  it('renders the chart when data is available', () => {
    render(<BankrollChart data={demoBankroll} />);
    expect(screen.getByLabelText('Évolution de la bankroll')).toBeInTheDocument();
  });

  it('renders the empty state without data', () => {
    render(<BankrollChart data={[]} state="empty" />);
    expect(screen.getByText('Aucune donnée de bankroll à afficher.')).toBeInTheDocument();
  });

  it('renders loading and error states', () => {
    const { rerender } = render(<BankrollChart data={[]} state="loading" />);
    expect(screen.getByText('Chargement des données…')).toBeInTheDocument();
    rerender(<BankrollChart data={[]} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Le graphique est indisponible pour le moment.');
  });
});
