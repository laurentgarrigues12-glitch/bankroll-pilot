import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage development tools', () => {
  it('inspects and repairs legacy Winamax operations through explicit callbacks', async () => {
    const inspect = vi.fn().mockResolvedValue([{ id: 'tournament:1155831676:maltau', type: 'adjustment', amountCents: -1000, date: '2026-07-25', sourceId: 'tournament:1155831676:maltau', description: 'Legacy tournament' }]);
    const repair = vi.fn().mockResolvedValue({ repairedCount: 1 });
    render(<SettingsPage onSaved={vi.fn().mockResolvedValue(undefined)} onSimulateAccess={vi.fn().mockResolvedValue(undefined)} onInspectWinamax={inspect} onRepairWinamax={repair} />);

    fireEvent.click(screen.getByRole('button', { name: 'Inspecter les opérations Winamax' }));
    await waitFor(() => expect(screen.getByLabelText('Opérations Winamax inspectées').textContent).toContain('tournament:1155831676:maltau'));
    fireEvent.click(screen.getByRole('button', { name: 'Réparer les anciens imports Winamax' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('1 opération(s) Winamax réparée(s).'));
  });
});
