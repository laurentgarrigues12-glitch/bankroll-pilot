import { type ChangeEvent, type ReactElement, useRef, useState } from 'react';
import { AlertCircle, FileText, LoaderCircle, Upload } from 'lucide-react';
import { importWinamaxFiles } from './importWinamaxFiles';
import type { WinamaxImportSummary } from '../../domain/winamax/types';
import './WinamaxImportPanel.css';

type ImportState = 'idle' | 'loading' | 'success' | 'partial' | 'invalid';

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export function WinamaxImportPanel(): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>('idle');
  const [summary, setSummary] = useState<WinamaxImportSummary | null>(null);
  const analyze = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length === 0) return;
    setState('loading');
    const nextSummary = await importWinamaxFiles(files);
    setSummary(nextSummary);
    setState(nextSummary.validHandCount === 0 ? 'invalid' : nextSummary.errorCount > 0 ? 'partial' : 'success');
    if (inputRef.current !== null) inputRef.current.value = '';
  };
  return <section className="import-panel" aria-label="Prévisualisation de l’import Winamax">
    <input ref={inputRef} className="file-input" type="file" accept=".txt" multiple onChange={(event) => void analyze(event)} />
    <button className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={17} /> Sélectionner des historiques Winamax</button>
    {state === 'idle' && <p className="import-note">Sélectionnez un ou plusieurs fichiers texte. L’analyse est une prévisualisation et ne modifie pas votre bankroll.</p>}
    {state === 'loading' && <p className="import-status"><LoaderCircle className="spin" size={17} /> Analyse des historiques en cours…</p>}
    {summary !== null && state !== 'loading' && <ImportSummary summary={summary} state={state} />}
  </section>;
}

function ImportSummary({ summary, state }: { summary: WinamaxImportSummary; state: ImportState }): ReactElement {
  const className = state === 'invalid' ? 'invalid' : state === 'partial' ? 'partial' : 'success';
  return <div className={`import-summary ${className}`}><p className="import-status"><FileText size={17} /> Prévisualisation terminée</p><div className="import-stats"><span>Fichiers<strong>{summary.fileCount}</strong></span><span>Blocs détectés<strong>{summary.detectedBlockCount}</strong></span><span>Mains valides<strong>{summary.validHandCount}</strong></span><span>Doublons<strong>{summary.duplicateCount}</strong></span><span>Erreurs<strong>{summary.errorCount}</strong></span><span>Résultat net<strong className={summary.netResultTotal >= 0 ? 'positive' : 'negative'}>{summary.netResultTotal >= 0 ? '+' : ''}{money.format(summary.netResultTotal)}</strong></span></div>{summary.errors.length > 0 && <div className="import-errors" role="alert"><p><AlertCircle size={16} /> Erreurs détectées</p><ul>{summary.errors.slice(0, 5).map((item, index) => <li key={`${item.fileName ?? 'fichier'}-${item.blockIndex}-${index}`}>{item.fileName ?? 'Fichier'} : {item.message}</li>)}</ul></div>}</div>;
}
