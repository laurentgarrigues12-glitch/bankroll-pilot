import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addOperation: vi.fn(),
  createOperation: vi.fn((type: string, amountCents: number, date: string, comment: string) => ({ type, amountCents, date, comment })),
}));

vi.mock('../../application/bankroll/bankrollService', () => ({
  bankrollService: {
    addOperation: mocks.addOperation,
    createOperation: mocks.createOperation,
  },
}));

import { OperationsPage } from './OperationsPage';

const onSaved = vi.fn().mockResolvedValue(undefined);

describe('OperationsPage', () => {
  beforeEach(() => {
    mocks.addOperation.mockResolvedValue(undefined);
    mocks.addOperation.mockClear();
    mocks.createOperation.mockClear();
    onSaved.mockClear();
  });

  it('saves a valid deposit in cents and refreshes the shared data', async () => {
    render(<OperationsPage operations={[]} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Montant'), { target: { value: '12,50' } });
    fireEvent.change(screen.getByLabelText('Commentaire (optionnel)'), { target: { value: 'Recharge' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createOperation).toHaveBeenCalledWith('deposit', 1250, expect.any(String), 'Recharge'));
    expect(mocks.addOperation).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole('status')).textContent).toContain('Opération enregistrée.');
    expect((screen.getByLabelText('Montant') as HTMLInputElement).value).toBe('');
  });

  it('saves a withdrawal and accepts an empty comment', async () => {
    render(<OperationsPage operations={[]} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'withdrawal' } });
    fireEvent.change(screen.getByLabelText('Montant'), { target: { value: '20.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createOperation).toHaveBeenCalledWith('withdrawal', 2000, expect.any(String), ''));
  });

  it.each(['', '-10', 'hello', '10.999'])('rejects the invalid amount %s', async (amount) => {
    render(<OperationsPage operations={[]} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Montant'), { target: { value: amount } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect((await screen.findByRole('status')).textContent).toContain('Veuillez renseigner un montant positif valide et une date.');
    expect(mocks.addOperation).not.toHaveBeenCalled();
  });

  it('shows only deposits and withdrawals from newest to oldest', () => {
    render(<OperationsPage onSaved={onSaved} operations={[
      { id: 'older', type: 'deposit', amountCents: 1000, date: '2026-07-01', comment: '', createdAt: '2026-07-01T00:00:00.000Z' },
      { id: 'newer', type: 'withdrawal', amountCents: 2500, date: '2026-07-10', comment: 'Cashout', createdAt: '2026-07-10T00:00:00.000Z' },
      { id: 'winamax', type: 'adjustment', amountCents: 1500, date: '2026-07-12', comment: 'Expresso Nitro', createdAt: '2026-07-12T00:00:00.000Z' },
      { id: 'manual-adjustment', type: 'adjustment', amountCents: 500, date: '2026-07-11', comment: 'Ajustement manuel', createdAt: '2026-07-11T00:00:00.000Z' },
    ]} />);

    const rows = screen.getAllByRole('row');
    expect(rows[1]?.textContent).toContain('2026-07-10');
    expect(rows[1]?.textContent).toContain('Retrait');
    expect(rows[2]?.textContent).toContain('2026-07-01');
    expect(rows[2]?.textContent).toContain('Dépôt');
    expect(rows[2]?.textContent).toContain('—');
    expect(screen.queryByText('adjustment')).toBeNull();
    expect(screen.queryByText('Expresso Nitro')).toBeNull();
    expect(screen.queryByText('Ajustement manuel')).toBeNull();
  });

  it('explains when no deposit or withdrawal is available', () => {
    render(<OperationsPage onSaved={onSaved} operations={[
      { id: 'winamax', type: 'adjustment', amountCents: 1500, date: '2026-07-12', comment: 'Expresso Nitro', createdAt: '2026-07-12T00:00:00.000Z' },
      { id: 'manual-adjustment', type: 'adjustment', amountCents: 500, date: '2026-07-11', comment: 'Ajustement manuel', createdAt: '2026-07-11T00:00:00.000Z' },
    ]} />);

    expect(screen.getByText('Aucun dépôt ou retrait enregistré.')).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
