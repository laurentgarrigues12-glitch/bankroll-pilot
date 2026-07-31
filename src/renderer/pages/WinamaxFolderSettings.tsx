import { type ReactElement, useEffect, useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { bankrollService } from '../../application/bankroll/bankrollService';
import { winamaxFolderService } from '../../application/winamax/winamaxFolderService';
import { toWinamaxOperationImports } from '../../features/winamax/toWinamaxOperationImports';
import {
  directoryPickerCompatibilityMessage,
  isDirectoryPickerSupported,
  type WinamaxFolderConfiguration,
} from '../../infrastructure/filesystem/fileSystemAccessSupport';

interface WinamaxFolderSettingsProps {
  readOnly: boolean;
  onImported: () => Promise<void>;
}

export function WinamaxFolderSettings({
  readOnly,
  onImported,
}: WinamaxFolderSettingsProps): ReactElement {
  const [configuration, setConfiguration] = useState<WinamaxFolderConfiguration>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supported = isDirectoryPickerSupported();

  useEffect(() => {
    let active = true;

    const loadConfiguration = async (): Promise<void> => {
      const configured = await winamaxFolderService.getConfiguration();
      if (active) setConfiguration(configured);

      if (configured?.autoScanEnabled !== true) return;

      try {
        const result = await winamaxFolderService.scan(false);
        if (active) setConfiguration(result.configuration);
      } catch {
        // Un scan en arrière-plan ne demande jamais de permission.
      }
    };

    void loadConfiguration();

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void loadConfiguration();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const scanAndImport = async (): Promise<void> => {
    const result = await winamaxFolderService.scan();
    setConfiguration(result.configuration);

    const importableEntries = result.preview.entries.filter((entry) => entry.status !== 'error');

    if (importableEntries.length === 0) {
      setMessage('Aucun fichier importé.');
      return;
    }

    const importResult = await bankrollService.importWinamaxFolderOperations(
      toWinamaxOperationImports(importableEntries),
      result.sourceFingerprintsByImportKey,
    );

    await onImported();

    if (importResult.importedCount > 0) {
      setMessage('Import réussi.');
      return;
    }

    setMessage('Aucun fichier importé.');
  };

  const choose = async (): Promise<void> => {
    if (!supported) return;

    setBusy(true);
    setMessage(null);

    try {
      const handle = await (
        window as unknown as Window & {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker();

      const next: WinamaxFolderConfiguration = {
        directoryHandle: handle,
        directoryName: handle.name,
        selectedAt: new Date().toISOString(),
        autoScanEnabled: false,
      };

      await winamaxFolderService.saveConfiguration(next);
      setConfiguration(next);
      await scanAndImport();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessage('Sélection du dossier annulée.');
      } else {
        setMessage(error instanceof Error ? error.message : 'L’import du dossier Winamax a échoué.');
      }
    } finally {
      setBusy(false);
    }
  };

  const rescan = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);

    try {
      await scanAndImport();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'L’import du dossier Winamax a échoué.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAutomaticScan = async (): Promise<void> => {
    if (configuration === undefined) return;

    const next = {
      ...configuration,
      autoScanEnabled: !configuration.autoScanEnabled,
    };

    await winamaxFolderService.saveConfiguration(next);
    setConfiguration(next);
  };

  return (
    <section className="backup-card winamax-folder-card" aria-labelledby="winamax-folder-title">
      <header className="winamax-folder-header">
        <p className="section-kicker">IMPORTATION</p>
        <h2 id="winamax-folder-title">Dossier Winamax</h2>
      </header>

      {!supported ? (
        <p className="winamax-folder-description">{directoryPickerCompatibilityMessage}</p>
      ) : configuration === undefined ? (
        <>
          <p className="winamax-folder-description">
            Choisissez le dossier contenant vos historiques Winamax. Les fichiers détectés seront
            importés immédiatement.
          </p>
          <div className="winamax-folder-primary-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={busy || readOnly}
              onClick={() => void choose()}
            >
              <FolderOpen size={17} />
              {busy ? 'Import en cours…' : 'Choisir le dossier Winamax'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="winamax-folder-primary-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={busy || readOnly}
              onClick={() => void choose()}
            >
              <FolderOpen size={17} /> Changer de dossier
            </button>
            <button
              className="button-secondary"
              type="button"
              disabled={busy || readOnly}
              onClick={() => void rescan()}
            >
              <RefreshCw size={17} />
              {busy ? 'Import en cours…' : 'Rescanner'}
            </button>
          </div>

          <div className="winamax-folder-options">
            <label className="winamax-auto-scan-option">
              <input
                type="checkbox"
                checked={configuration.autoScanEnabled}
                disabled={busy || readOnly}
                onChange={() => void toggleAutomaticScan()}
              />
              <span>Scanner automatiquement à l’ouverture</span>
            </label>
          </div>
        </>
      )}

      {message !== null && (
        <p className="winamax-folder-status" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
