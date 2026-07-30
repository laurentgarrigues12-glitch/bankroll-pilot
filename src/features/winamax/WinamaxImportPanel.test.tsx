import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WinamaxImportPanel } from './WinamaxImportPanel';

describe('WinamaxImportPanel', () => {
  it('opens the file selector and displays an import preview', async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<WinamaxImportPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner des historiques Winamax' }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    const file = new File([], 'history.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'Winamax Poker - CashGame - HandId: #300001 - Holdem no limit (0,05€/0,10€) - 2026/07/30 12:00:00 UTC\nTable: \'Latte\'\nHero posts small blind 0,05€\nDealt to Hero [As Kd]\nHero collected 0,20€ from pot' });
    fireEvent.change(screen.getByLabelText('Prévisualisation de l’import Winamax').querySelector('input')!, { target: { files: [file] } });
    expect(await screen.findByText('Prévisualisation terminée')).toBeInTheDocument();
    expect(screen.getByText('Mains valides')).toBeInTheDocument();
  });
});
