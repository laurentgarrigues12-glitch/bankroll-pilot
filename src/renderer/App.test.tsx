import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('opens the browser import control in settings', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(await screen.findByRole('button', { name: 'Sélectionner des historiques Winamax' })).toBeInTheDocument();
  });

  it('displays the primary demonstration cards and changes the chart period', async () => {
    render(<App />);
    expect(screen.getByText('Bankroll actuelle')).toBeInTheDocument();
    expect(screen.getByText('Résultat du jour')).toBeInTheDocument();
    expect(screen.getByText('Résultat du mois')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '7 jours' }));
    expect(await screen.findByText('Période affichée : 7 jours')).toBeInTheDocument();
  });
});
