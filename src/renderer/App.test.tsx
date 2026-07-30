import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('presents the browser import notice in settings', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(await screen.findByText('Import des historiques Winamax (version navigateur) — fonctionnalité en cours de développement.')).toBeInTheDocument();
  });
});
