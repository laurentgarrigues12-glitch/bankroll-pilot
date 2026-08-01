import {
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Download, FileUp, LoaderCircle, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import type { BankrollBackup } from '../../domain/bankroll/backup';
import { parseBankrollBackup } from '../../domain/bankroll/backup';
import type { BankrollSettings } from '../../domain/bankroll/types';
import {
  bankrollService,
  type WinamaxOperationInspection,
} from '../../application/bankroll/bankrollService';
import type { AccessState } from '../../domain/access/types';
import type { DevelopmentAccessScenario } from '../../application/access/accessProvider';
import type { WinamaxImportDiagnostic } from '../winamaxImportDiagnostic';

interface SettingsPageProps {
  settings?: BankrollSettings;
  onSaved: () => Promise<void>;
  access?: AccessState;
  onSimulateAccess?: (scenario: DevelopmentAccessScenario) => Promise<void>;
  winamaxDiagnostic?: WinamaxImportDiagnostic | null;
  onInspectWinamax?: () => Promise<WinamaxOperationInspection[]>;
  onRepairWinamax?: () => Promise<{ repairedCount: number }>;
}

const toCents = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

interface SaveFileHandle {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface OpenFileHandle {
  getFile: () => Promise<File>;
}

type OpenFilePicker = (options: {
  startIn: 'documents';
  multiple: false;
  excludeAcceptAllOption: true;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<OpenFileHandle[]>;

type SaveFilePicker = (options: {
  suggestedName: string;
  startIn: 'documents';
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<SaveFileHandle>;

const saveBackup = async (backup: BankrollBackup): Promise<boolean> => {
  const fileName = 'Sauvegarde Winamax.json';
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const saveFilePicker = (
    window as typeof window & { showSaveFilePicker?: SaveFilePicker }
  ).showSaveFilePicker;

  if (saveFilePicker !== undefined) {
    try {
      const handle = await saveFilePicker({
        suggestedName: fileName,
        startIn: 'documents',
        types: [
          {
            description: 'Sauvegarde Bankroll Pilot',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
};

export function SettingsPage({
  settings,
  onSaved,
  access,
  onSimulateAccess,
  winamaxDiagnostic,
  onInspectWinamax,
  onRepairWinamax,
}: SettingsPageProps): ReactElement {
  const readOnly = access !== undefined && !access.canWrite;
  const [amount, setAmount] = useState(
    settings === undefined ? '' : (settings.initialBankrollCents / 100).toFixed(2),
  );
  const [date, setDate] = useState(settings?.startDate ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BankrollBackup | null>(null);
  const [pendingBackupFileName, setPendingBackupFileName] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (settings !== undefined)
      queueMicrotask(() => {
        setAmount((settings.initialBankrollCents / 100).toFixed(2));
        setDate(settings.startDate);
      });
  }, [settings]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const cents = toCents(amount);
    if (cents === null || date === '') {
      setMessage('Veuillez renseigner un montant valide et une date.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await bankrollService.saveSettings({
        id: 'current',
        initialBankrollCents: cents,
        currency: 'EUR',
        startDate: date,
      });
      await onSaved();
      setMessage('Configuration enregistrée.');
    } catch {
      setMessage(null);
    } finally {
      setSaving(false);
    }
  };
  const exportBackup = async (): Promise<void> => {
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      const saved = await saveBackup(await bankrollService.createBackup());
      if (saved) setBackupMessage('Sauvegarde enregistrée avec succès.');
    } catch {
      setBackupMessage('La sauvegarde n’a pas pu être générée.');
    } finally {
      setBackupBusy(false);
    }
  };
  const prepareBackupRestore = async (file: File): Promise<void> => {
    if (!file.name.toLowerCase().endsWith('.json') || file.size > 5 * 1024 * 1024) {
      setBackupMessage('Sélectionnez un fichier JSON de 5 Mo maximum.');
      return;
    }
    setBackupBusy(true);
    setBackupMessage(null);
    setPendingBackupFileName(null);
    try {
      const backup = parseBankrollBackup(JSON.parse(await file.text()) as unknown);
      setPendingBackup(backup);
      setPendingBackupFileName(file.name);
    } catch (error) {
      setPendingBackup(null);
      setBackupMessage(
        error instanceof Error
          ? `Sauvegarde Bankroll Pilot refusée : ${error.message}`
          : 'Ce fichier n’est pas une sauvegarde Bankroll Pilot valide.',
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file !== undefined) await prepareBackupRestore(file);
  };

  const chooseBackup = async (): Promise<void> => {
    const openFilePicker = (
      window as typeof window & { showOpenFilePicker?: OpenFilePicker }
    ).showOpenFilePicker;

    if (openFilePicker === undefined) {
      fileInputRef.current?.click();
      return;
    }

    setBackupMessage(null);
    try {
      const handles = await openFilePicker({
        startIn: 'documents',
        multiple: false,
        excludeAcceptAllOption: true,
        types: [
          {
            description: 'Sauvegarde Bankroll Pilot',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const handle = handles[0];
      if (handle !== undefined) await prepareBackupRestore(await handle.getFile());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setBackupMessage('Le fichier de sauvegarde n’a pas pu être ouvert.');
    }
  };
  const restoreBackup = async (): Promise<void> => {
    if (pendingBackup === null) return;
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      await bankrollService.restoreBackup(pendingBackup);
      await onSaved();
      setPendingBackup(null);
      setPendingBackupFileName(null);
      setBackupMessage('Sauvegarde restaurée avec succès.');
    } catch {
      setBackupMessage('La restauration a échoué. Les données existantes ont été conservées.');
    } finally {
      setBackupBusy(false);
    }
  };

  const resetBankroll = async (): Promise<void> => {
    setResetBusy(true);
    setResetMessage(null);
    try {
      await bankrollService.resetBankroll();
      await onSaved();
      setAmount('');
      setDate('');
      setResetPending(false);
      setResetMessage('La bankroll a été réinitialisée.');
    } catch {
      setResetMessage('La bankroll n’a pas pu être réinitialisée.');
    } finally {
      setResetBusy(false);
    }
  };


  return (
    <section className="settings-page">
      <section className="settings-card">
        <div className="settings-heading">
          <div>
            <p className="section-kicker">CONFIGURATION</p>
            <h2>Bankroll initiale</h2>
          </div>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Bankroll initiale
            <input
              disabled={readOnly}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              required
            />
          </label>
          <label>
            Date de départ
            <input
              disabled={readOnly}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <button className="secondary-button" disabled={saving || readOnly} type="submit">
            {saving ? (
              <>
                <LoaderCircle className="spin" size={16} /> Enregistrement…
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
          {readOnly && (
            <p role="status">Mode lecture seule : la configuration ne peut pas être modifiée.</p>
          )}
          {message !== null && <p role="status">{message}</p>}
        </form>
      </section>
      <section className="backup-card" aria-labelledby="backup-title">
        <div>
          <p className="section-kicker">DONNÉES LOCALES</p>
          <h2 id="backup-title">Sauvegarde et restauration</h2>
          <p>
            Vos données restent sur cet appareil. Exportez-les pour les conserver ou les transférer.
          </p>
        </div>
        <div className="backup-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={backupBusy}
            onClick={() => void exportBackup()}
          >
            <Download size={17} /> Sauvegarder mes données
          </button>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="application/json,.json"
            aria-label="Fichier de sauvegarde"
            disabled={readOnly}
            onChange={(event) => void selectBackup(event)}
          />
          <button
            className="button-secondary"
            type="button"
            disabled={backupBusy || readOnly}
            onClick={() => void chooseBackup()}
          >
            <FileUp size={17} /> Restaurer une sauvegarde
          </button>
        </div>
        {backupMessage !== null && <p role="status">{backupMessage}</p>}
      </section>
      <section className="danger-zone" aria-labelledby="reset-bankroll-title">
        <div>
          <p className="section-kicker">ZONE SENSIBLE</p>
          <h2 id="reset-bankroll-title">Réinitialiser la bankroll</h2>
          <p>
            Remettez la bankroll actuelle, les opérations, les résultats et le graphique à zéro.
            Le dossier Winamax sélectionné et les fichiers déjà traités restent mémorisés.
          </p>
        </div>
        <button
          className="button-danger"
          type="button"
          disabled={readOnly || resetBusy}
          onClick={() => setResetPending(true)}
          title={readOnly ? 'L’essai est terminé : la réinitialisation est indisponible.' : undefined}
        >
          <Trash2 size={17} /> Réinitialiser la bankroll
        </button>
        {readOnly && <p role="status">Mode lecture seule : la réinitialisation est indisponible.</p>}
        {resetMessage !== null && <p role="status">{resetMessage}</p>}
      </section>
      {resetPending && (
        <div className="confirmation-backdrop" role="presentation">
          <section
            className="confirmation-dialog danger-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirmation-title"
          >
            <TriangleAlert size={26} />
            <h2 id="reset-confirmation-title">Confirmer la réinitialisation</h2>
            <p>
              Cette action effacera définitivement toutes les données : bankroll, dépôts, retraits et fichiers
              Winamax importés. Cette action est irréversible. Une sauvegarde est recommandée avant de continuer.
            </p>
            <div>
              <button
                className="text-button"
                type="button"
                disabled={resetBusy}
                onClick={() => setResetPending(false)}
              >
                Annuler
              </button>
              <button
                className="button-danger"
                type="button"
                disabled={resetBusy || readOnly}
                onClick={() => void resetBankroll()}
              >
                {resetBusy ? 'Réinitialisation…' : 'Confirmer la réinitialisation'}
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingBackup !== null && (
        <div className="confirmation-backdrop" role="presentation">
          <section
            className="confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
          >
            <ShieldCheck size={24} />
            <h2 id="restore-title">Confirmer la restauration</h2>
            <p>
              Fichier sélectionné : <strong>{pendingBackupFileName ?? 'Sauvegarde Bankroll Pilot'}</strong>.
            </p>
            <p>
              Sauvegarde du {new Date(pendingBackup.exportedAt).toLocaleString('fr-FR')}
            </p>
            <p>Cette action remplacera toutes les données actuelles.</p>
            <div>
              <button
                className="text-button"
                type="button"
                disabled={backupBusy}
                onClick={() => {
                  setPendingBackup(null);
                  setPendingBackupFileName(null);
                }}
              >
                Annuler
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={backupBusy || readOnly}
                onClick={() => void restoreBackup()}
              >
                {backupBusy ? 'Restauration…' : 'Confirmer la restauration'}
              </button>
            </div>
          </section>
        </div>
      )}
      {import.meta.env.DEV && onSimulateAccess !== undefined && (
        <DevelopmentTools
          onSimulate={onSimulateAccess}
          winamaxDiagnostic={winamaxDiagnostic}
          onInspectWinamax={onInspectWinamax}
          onRepairWinamax={onRepairWinamax}
        />
      )}
    </section>
  );
}

function DevelopmentTools({
  onSimulate,
  winamaxDiagnostic,
  onInspectWinamax,
  onRepairWinamax,
}: {
  onSimulate: (scenario: DevelopmentAccessScenario) => Promise<void>;
  winamaxDiagnostic?: WinamaxImportDiagnostic | null;
  onInspectWinamax?: () => Promise<WinamaxOperationInspection[]>;
  onRepairWinamax?: () => Promise<{ repairedCount: number }>;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const [operations, setOperations] = useState<WinamaxOperationInspection[] | null>(null);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const run = async (scenario: DevelopmentAccessScenario): Promise<void> => {
    setBusy(true);
    try {
      await onSimulate(scenario);
    } finally {
      setBusy(false);
    }
  };
  const inspect = async (): Promise<void> => {
    if (onInspectWinamax === undefined) return;
    setBusy(true);
    try {
      setOperations(await onInspectWinamax());
    } finally {
      setBusy(false);
    }
  };
  const repair = async (): Promise<void> => {
    if (onRepairWinamax === undefined) return;
    setBusy(true);
    try {
      const result = await onRepairWinamax();
      setRepairMessage(`${result.repairedCount} opération(s) Winamax réparée(s).`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="development-tools">
      <p className="section-kicker">DÉVELOPPEMENT</p>
      <h2>Outils de développement</h2>
      <p>Version diagnostic : WINAMAX-DEBUG-2026-07-30-V3</p>
      <p>Simulations locales uniquement. Les données de bankroll ne sont pas modifiées.</p>
      <div>
        {(
          [
            ['reset', 'Réinitialiser l’essai'],
            ['trial', 'Simuler essai actif'],
            ['expired', 'Simuler essai expiré'],
            ['active', 'Simuler accès complet'],
            ['unavailable', 'Simuler service indisponible'],
          ] as const
        ).map(([scenario, label]) => (
          <button
            key={scenario}
            className="button-secondary"
            disabled={busy}
            type="button"
            onClick={() => void run(scenario)}
          >
            {label}
          </button>
        ))}
        {onInspectWinamax !== undefined && (
          <button
            className="button-secondary"
            disabled={busy}
            type="button"
            onClick={() => void inspect()}
          >
            Inspecter les opérations Winamax
          </button>
        )}
        {onRepairWinamax !== undefined && (
          <button
            className="button-secondary"
            disabled={busy}
            type="button"
            onClick={() => void repair()}
          >
            Réparer les anciens imports Winamax
          </button>
        )}
      </div>
      {winamaxDiagnostic !== null && winamaxDiagnostic !== undefined && (
        <section aria-label="Diagnostic import Winamax">
          <h3>Diagnostic import Winamax</h3>
          <pre>{JSON.stringify(winamaxDiagnostic, null, 2)}</pre>
        </section>
      )}
      {repairMessage !== null && <p role="status">{repairMessage}</p>}
      {operations !== null && (
        <pre aria-label="Opérations Winamax inspectées">{JSON.stringify(operations, null, 2)}</pre>
      )}
    </section>
  );
}
