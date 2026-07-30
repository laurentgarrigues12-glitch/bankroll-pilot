import { type ChangeEvent, type DragEvent, type ReactElement, useRef, useState } from 'react';
import { AlertCircle, Check, FileUp, LoaderCircle, TriangleAlert, Upload, X } from 'lucide-react';
import { bankrollService } from '../../application/bankroll/bankrollService';
import type { WinamaxPreviewEntry } from '../../domain/winamax/winamaxPreviewParser';
import { previewWinamaxFiles, type WinamaxFilesPreview } from '../../features/winamax/previewWinamaxFiles';
import { toWinamaxOperationImports } from '../../features/winamax/toWinamaxOperationImports';
import './WinamaxImportPage.css';

interface WinamaxImportPageProps { onImported: () => Promise<void>; readOnly?: boolean; }
interface ImportResult { importedCount: number; duplicateCount: number; ignoredErrorCount: number; totalCount: number; }

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

export function WinamaxImportPage({ onImported, readOnly = false }: WinamaxImportPageProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<WinamaxFilesPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const analyze = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    setLoading(true);
    setConfirmationOpen(false);
    setResult(null);
    setPreview(await previewWinamaxFiles(files));
    setLoading(false);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>): void => { void analyze(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; };
  const onDrop = (event: DragEvent<HTMLDivElement>): void => { event.preventDefault(); void analyze(Array.from(event.dataTransfer.files)); };
  const complete = (nextResult: ImportResult): void => { setResult(nextResult); setConfirmationOpen(false); };

  return <section className="winamax-import-page">
    <div className="winamax-import-heading"><p className="section-kicker">IMPORT WINAMAX</p><h2>Prévisualiser vos historiques</h2><p>Les fichiers sont analysés uniquement dans votre navigateur.</p></div>
    <input ref={inputRef} className="file-input" type="file" accept=".txt,.csv" multiple disabled={readOnly} onChange={onInputChange} aria-label="Fichiers Winamax" />
    <div className="winamax-dropzone" onDragOver={(event) => { if (!readOnly) event.preventDefault(); }} onDrop={(event) => { if (!readOnly) onDrop(event); }}><FileUp size={28} /><strong>Glissez vos fichiers Winamax ici</strong><span>Formats acceptés : .txt, .csv</span><button className="secondary-button" type="button" disabled={readOnly} title={readOnly ? 'L’essai est terminé : l’import est indisponible.' : undefined} onClick={() => inputRef.current?.click()}><Upload size={17} /> Choisir des fichiers</button></div>
    {readOnly && <p className="winamax-import-note" role="status">Mode lecture seule : l’import Winamax est indisponible.</p>}
    {loading && <p className="winamax-import-loading">Analyse des fichiers en cours…</p>}
    {result !== null && <FinalSummary result={result} />}
    {preview !== null && !loading && <ImportPreview preview={preview} onConfirm={() => setConfirmationOpen(true)} />}
    {preview !== null && confirmationOpen && <ConfirmationDialog preview={preview} onClose={() => setConfirmationOpen(false)} onCompleted={complete} onImported={onImported} />}
  </section>;
}

function ImportPreview({ preview, onConfirm }: { preview: WinamaxFilesPreview; onConfirm: () => void }): ReactElement {
  const counts = summaryCounts(preview.entries);
  const tournamentOnly = preview.entries.length > 0 && preview.entries.every((entry) => entry.kind === 'tournament');
  return <div className="winamax-preview">
    {preview.invalidFileNames.length > 0 && <p className="winamax-import-error" role="alert"><AlertCircle size={16} /> Format non pris en charge : {preview.invalidFileNames.join(', ')}. Utilisez des fichiers .txt ou .csv.</p>}
    <section className="winamax-validation-summary" aria-label="Résumé de validation"><span><Check size={16} /> Valides <strong>{counts.valid}</strong></span><span><TriangleAlert size={16} /> Avertissements <strong>{counts.warning}</strong></span><span><X size={16} /> Erreurs <strong>{counts.error}</strong></span></section>
    {tournamentOnly && <p className="winamax-import-note">{preview.entries.reduce((total, entry) => total + (entry.handCount ?? 0), 0)} mains détectées · {preview.entries.reduce((total, entry) => total + (entry.handCount ?? 0), 0)} mains reconnues · 0 main ignorée · {counts.valid} tournoi importable.</p>}
    {preview.files.map((file) => <article className="winamax-file-card" key={file.name}><div><h3>{file.name}</h3><p>{formatSize(file.size)}</p></div><dl><div><dt>Lignes</dt><dd>{file.lineCount}</dd></div><div><dt>Reconnues</dt><dd>{file.recognizedLineCount}</dd></div><div><dt>Ignorées</dt><dd>{file.ignoredLineCount}</dd></div></dl>{file.errors.length > 0 && <ul className="winamax-file-errors">{file.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>}</article>)}
    {preview.files.length > 0 && <PreviewTable entries={preview.entries} />}
    <button className="secondary-button" type="button" disabled={counts.error > 0 || preview.invalidFileNames.length > 0} onClick={onConfirm} title={counts.error > 0 || preview.invalidFileNames.length > 0 ? 'Corrigez les erreurs avant de poursuivre.' : undefined}>Importer</button>
    <p className="winamax-import-note">{counts.error > 0 || preview.invalidFileNames.length > 0 ? 'Les erreurs de validation ou de format doivent être corrigées avant import.' : 'Les lignes validées seront importées après confirmation.'}</p>
  </div>;
}

function PreviewTable({ entries }: { entries: WinamaxPreviewEntry[] }): ReactElement {
  if (entries.length === 0) return <p className="winamax-import-note">Aucune ligne exploitable à afficher.</p>;
  if (entries.every((entry) => entry.kind === 'tournament')) return <div className="winamax-table-wrapper"><table><thead><tr><th>Date</th><th>Tournoi</th><th>Joueur</th><th>Buy-in</th><th>Résultat net</th><th>Classement</th><th>Mains</th><th>Statut</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.tournamentId}><td>{entry.date}</td><td>{entry.detectedType}</td><td>{entry.playerName}</td><td>{money.format((entry.buyInCents ?? 0) / 100)}</td><td>{money.format((entry.amountCents ?? 0) / 100)}</td><td>{entry.finishingPosition ?? '?'}e sur {entry.registeredPlayers ?? '?'}</td><td>{entry.handCount}</td><td><Status entry={entry} /></td></tr>)}</tbody></table></div>;
  return <div className="winamax-table-wrapper"><table><thead><tr><th>État</th><th>Date</th><th>Type détecté</th><th>Montant</th><th>Description d’origine</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={`${entry.originalDescription}-${index}`}><td><Status entry={entry} /></td><td>{entry.date ?? '—'}</td><td>{entry.detectedType}</td><td>{entry.amountCents === undefined ? '—' : money.format(entry.amountCents / 100)}</td><td>{entry.originalDescription || '—'}<small className="validation-message">{entry.message}</small></td></tr>)}</tbody></table></div>;
}

function Status({ entry }: { entry: WinamaxPreviewEntry }): ReactElement {
  if (entry.status === 'valid') return <span className="validation-status valid"><Check size={15} /> Valide</span>;
  if (entry.status === 'warning') return <span className="validation-status warning"><TriangleAlert size={15} /> Avertissement</span>;
  return <span className="validation-status error"><X size={15} /> Erreur</span>;
}

function ConfirmationDialog({ preview, onClose, onCompleted, onImported }: { preview: WinamaxFilesPreview; onClose: () => void; onCompleted: (result: ImportResult) => void; onImported: () => Promise<void> }): ReactElement {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counts = summaryCounts(preview.entries);
  const confirm = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const outcome = await bankrollService.importWinamaxOperations(toWinamaxOperationImports(preview.entries));
      await onImported();
      onCompleted({ importedCount: outcome.importedCount, duplicateCount: outcome.duplicateCount, ignoredErrorCount: counts.error, totalCount: preview.entries.length });
    } catch {
      setError('L’import n’a pas pu être enregistré. Vérifiez vos données puis réessayez.');
    } finally {
      setSaving(false);
    }
  };
  return <div className="confirmation-backdrop" role="presentation"><section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-title"><h2 id="confirmation-title">Confirmer l’import</h2><p>{counts.valid + counts.warning} ligne(s) importable(s), {counts.warning} avertissement(s), {counts.error} ligne(s) ignorée(s).</p><p>Les doublons déjà importés seront ignorés.</p>{error !== null && <p className="winamax-import-error" role="alert">{error}</p>}<div><button className="text-button" type="button" disabled={saving} onClick={onClose}>Annuler</button><button className="secondary-button" type="button" disabled={saving} onClick={() => void confirm()}>{saving ? <><LoaderCircle className="spin" size={16} /> Import en cours…</> : 'Confirmer'}</button></div></section></div>;
}

function FinalSummary({ result }: { result: ImportResult }): ReactElement {
  return <section className="winamax-final-summary" role="status"><strong>Import terminé</strong><span>{result.importedCount} ligne(s) importée(s)</span><span>{result.duplicateCount} doublon(s) ignoré(s)</span><span>{result.ignoredErrorCount} ligne(s) en erreur ignorée(s)</span><span>{result.totalCount} ligne(s) traitée(s)</span></section>;
}

function summaryCounts(entries: WinamaxPreviewEntry[]): { valid: number; warning: number; error: number } { return entries.reduce((counts, entry) => ({ ...counts, [entry.status]: counts[entry.status] + 1 }), { valid: 0, warning: 0, error: 0 }); }
function formatSize(size: number): string { return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(size / 1024)} Ko`; }
