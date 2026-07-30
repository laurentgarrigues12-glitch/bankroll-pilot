import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mainFixture from '../../domain/winamax/fixtures/expresso_nitro_freeroll_real_holdem_no-limit.txt?raw';
import summaryFixture from '../../domain/winamax/fixtures/expresso_nitro_freeroll_real_holdem_no-limit_summary.txt?raw';

const mocks = vi.hoisted(() => ({ importWinamaxOperations: vi.fn() }));
vi.mock('../../application/bankroll/bankrollService', () => ({ bankrollService: { importWinamaxOperations: mocks.importWinamaxOperations } }));

import { WinamaxImportPage } from './WinamaxImportPage';

const file = (name: string, content: string): File => {
  const item = new File([], name, { type: 'text/plain' });
  Object.defineProperty(item, 'text', { value: async () => content });
  return item;
};

const onImported = vi.fn().mockResolvedValue(undefined);

describe('WinamaxImportPage', () => {
  beforeEach(() => { mocks.importWinamaxOperations.mockResolvedValue({ importedCount: 1, duplicateCount: 0 }); mocks.importWinamaxOperations.mockClear(); onImported.mockClear(); });

  it('imports valid lines in cents and refreshes the shared data', async () => {
    render(<WinamaxImportPage onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('history.csv', '2026-07-20;Dépôt;12,50;Recharge')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => expect(mocks.importWinamaxOperations).toHaveBeenCalledWith([expect.objectContaining({ type: 'deposit', amountCents: 1250, date: '2026-07-20', comment: '2026-07-20;Dépôt;12,50;Recharge' })]));
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('1 ligne(s) importée(s)');
  });

  it('imports a confirmed warning as an adjustment', async () => {
    render(<WinamaxImportPage onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('warning.csv', '2026-07-20;Mystère;5,00;Source')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => expect(mocks.importWinamaxOperations).toHaveBeenCalledWith([expect.objectContaining({ type: 'adjustment', amountCents: 500 })]));
  });

  it('excludes lines in error by keeping the import button disabled', async () => {
    render(<WinamaxImportPage onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('invalid.csv', '2026-99-20;Dépôt;12,50')] } });

    expect((await screen.findAllByText('Date invalide.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Importer' })).toBeDisabled();
    expect(mocks.importWinamaxOperations).not.toHaveBeenCalled();
  });

  it('keeps the import button disabled when a selected file format is invalid', async () => {
    render(<WinamaxImportPage onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('history.pdf', 'ignored')] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('history.pdf');
    expect(screen.getByRole('button', { name: 'Importer' })).toBeDisabled();
  });

  it('reports duplicate lines ignored by the transactional import', async () => {
    mocks.importWinamaxOperations.mockResolvedValueOnce({ importedCount: 0, duplicateCount: 1 });
    render(<WinamaxImportPage onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('duplicate.csv', '2026-07-20;Dépôt;12,50;Recharge')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('1 doublon(s) ignoré(s)');
  });

  it('keeps the preview visible and reports a save error', async () => {
    mocks.importWinamaxOperations.mockRejectedValueOnce(new Error('storage failure'));
    render(<WinamaxImportPage onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('history.csv', '2026-07-20;Dépôt;12,50;Recharge')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('L’import n’a pas pu être enregistré.');
    expect(screen.getByText('history.csv')).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('previews and imports one complete zero-result tournament', async () => {
    render(<WinamaxImportPage onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('expresso_nitro_freeroll_real_holdem_no-limit.txt', mainFixture), file('expresso_nitro_freeroll_real_holdem_no-limit_summary.txt', summaryFixture)] } });
    expect(await screen.findByText('Expresso Nitro Freeroll')).toBeInTheDocument();
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('3e sur 3')).toBeInTheDocument();
    expect(screen.getByText('5 mains détectées · 5 mains reconnues · 0 main ignorée · 1 tournoi importable.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(mocks.importWinamaxOperations).toHaveBeenCalledWith([expect.objectContaining({ type: 'adjustment', amountCents: 0, importKey: 'tournament:1155086037:hero' })]));
  });

  it('displays the total tournament cost including fees', async () => {
    render(<WinamaxImportPage onImported={onImported} />);
    const paidMain = mainFixture.replace('0€ + 0€', '9.30€ + 0.70€');
    const paidSummary = summaryFixture.replace('0€ + 0€', '9.30€ + 0.70€');
    fireEvent.change(screen.getByLabelText('Fichiers Winamax'), { target: { files: [file('paid.txt', paidMain), file('paid_summary.txt', paidSummary)] } });
    expect(await screen.findByText('10,00 €')).toBeInTheDocument();
  });
});
