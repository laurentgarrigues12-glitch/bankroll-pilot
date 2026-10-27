import { type FormEvent, type ReactElement, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDollarSign,
  Info,
  TriangleAlert,
} from 'lucide-react';
import type { FinancialOperation, FinancialOperationType } from '../../domain/bankroll/types';
import { bankrollService } from '../../application/bankroll/bankrollService';
import './OperationsPage.css';

interface OperationsPageProps {
  operations: FinancialOperation[];
  onSaved: () => Promise<void>;
  readOnly?: boolean;
}

const toCents = (
  value: string,
  signed = false,
): number | null => {
  const normalized = value.trim().replace(',', '.');

  const pattern = signed
    ? /^-?\d+(?:\.\d{1,2})?$/
    : /^\d+(?:\.\d{1,2})?$/;

  if (!pattern.test(normalized)) return null;

  const amount = Number(normalized);
  const cents = Math.round(amount * 100);

  return cents !== 0 ? cents : null;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const operationLabels: Record<Extract<FinancialOperationType, 'deposit' | 'withdrawal'>, string> = {
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
};

const isVisibleOperation = (
  operation: FinancialOperation,
): operation is FinancialOperation & {
  type: VisibleOperationType;
} =>
  operation.type === 'deposit' ||
  operation.type === 'withdrawal' ||
  operation.type === 'correction';

export function OperationsPage({
  operations,
  onSaved,
  readOnly = false,
}: OperationsPageProps): ReactElement {
  const [type, setType] =
    useState<VisibleOperationType>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const cashMovementHistory = useMemo(
    () =>
      operations.filter(isVisibleOperation).sort((left, right) => right.date.localeCompare(left.date)),
    [operations],
  );

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const amountCents = toCents(
      amount,
      type === 'correction',
    );

    if (amountCents === null || date === '') {
      setMessageTone('error');
      setMessage(
        type === 'correction'
          ? 'Veuillez renseigner un montant non nul valide et une date.'
          : 'Veuillez renseigner un montant positif valide et une date.',
      );
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await bankrollService.addOperation(
        bankrollService.createOperation(type, amountCents, date, comment),
      );
      await onSaved();
      setAmount('');
      setComment('');
      setMessageTone('success');
      setMessage('Opération enregistrée.');
    } catch {
      setMessageTone('error');
      setMessage('L’opération n’a pas pu être enregistrée.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="operations-page">
      <div className="operations-heading">
        <p className="section-kicker">SUIVI FINANCIER</p>
        <h2>Opérations</h2>
        <p>Enregistrez vos dépôts et retraits hors résultats de poker.</p>
      </div>
      <div className="operations-layout">
        <section className="operations-card" aria-labelledby="operation-form-title">
          <h3 id="operation-form-title">Nouvelle opération</h3>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Type
              <select
                disabled={readOnly}
                value={type}
                onChange={(event) =>
                  setType(
                    event.target.value as VisibleOperationType,
                  )
                }
              >
                <option value="deposit">Dépôt</option>
                <option value="withdrawal">Retrait</option>
                <option value="correction">Correctif</option>
              </select>
            </label>
            <label>
              Montant
              <input
                disabled={readOnly}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
            <label>
              Date
              <input
                disabled={readOnly}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              Commentaire <span className="optional-field">(optionnel)</span>
              <textarea
                disabled={readOnly}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
              />
            </label>
            <button
              className="secondary-button"
              disabled={saving || readOnly}
              title={
                readOnly ? 'L’essai est terminé : les opérations sont en lecture seule.' : undefined
              }
              type="submit"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {readOnly && (
              <p className="system-message info" role="status">
                <Info size={16} />
                Mode lecture seule : l’ajout d’opérations est indisponible.
              </p>
            )}
            {message !== null && (
              <p
                className={`system-message ${messageTone}`}
                role={messageTone === 'error' ? 'alert' : 'status'}
              >
                {messageTone === 'success' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <TriangleAlert size={16} />
                )}
                {message}
              </p>
            )}
          </form>
        </section>
        <section className="operations-card" aria-labelledby="operations-history-title">
          <h3 id="operations-history-title">Historique</h3>
          {cashMovementHistory.length === 0 ? (
            <div className="operations-empty">
              <span className="empty-state-icon">
                <CircleDollarSign size={22} />
              </span>
              <span className="state-badge">Historique vide</span>
              <h4>Aucun dépôt ou retrait enregistré</h4>
              <p>Vos prochains mouvements financiers apparaîtront ici.</p>
            </div>
          ) : (
            <div className="operations-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Montant</th>
                    <th>Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {cashMovementHistory.map((operation) => (
                    <tr key={operation.id}>
                      <td>{operation.date}</td>
                      <td>
                        <span className={`operation-type ${operation.type}`}>
                          {operation.type === 'deposit' ? (
                            <ArrowDownToLine size={13} />
                          ) : (
                            <ArrowUpFromLine size={13} />
                          )}
                          {operationLabels[operation.type]}
                        </span>
                      </td>
                      <td>{currency.format(operation.amountCents / 100)}</td>
                      <td>{operation.comment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
