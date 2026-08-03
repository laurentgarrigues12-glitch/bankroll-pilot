import { type ReactElement, useEffect, useState } from 'react';
import {
  CheckCircle2,
  MinusCircle,
  TriangleAlert,
} from 'lucide-react';
import { bankrollService } from '../../application/bankroll/bankrollService';
import { winamaxFolderService } from '../../application/winamax/winamaxFolderService';
import { toWinamaxOperationImports } from '../../features/winamax/toWinamaxOperationImports';
import {
  directoryPickerCompatibilityMessage,
  isDesktopApp,
  isDirectoryPickerSupported,
  type WinamaxFolderConfiguration,
} from '../../infrastructure/filesystem/fileSystemAccessSupport';

interface WinamaxFolderSettingsProps {
  readOnly: boolean;
  onImported: () => Promise<void>;
}

interface DesktopFolderSelection {
  directoryPath: string;
  directoryName: string;
}

interface BankrollDesktopBridge {
  isDesktop: boolean;
  selectWinamaxFolder: () => Promise<DesktopFolderSelection | null>;
}

export function WinamaxFolderSettings({
  readOnly,
  onImported,
}: WinamaxFolderSettingsProps): ReactElement {
  const [configuration, setConfiguration] =
    useState<WinamaxFolderConfiguration>();
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const messageTone =
    message === null
      ? 'info'
      : message.startsWith('Import réussi.')
        ? 'success'
        : message.includes('annulée') ||
            message === 'Aucun fichier importé.' ||
            message ===
              "Aucun nouvel historique de tournois n'a été importé."
          ? 'info'
          : 'error';

  const supported = isDirectoryPickerSupported();

  useEffect(() => {
    let active = true;

    const loadConfiguration = async (): Promise<void> => {
      const configured =
        await winamaxFolderService.getConfiguration();

      if (active) {
        setConfiguration(configured);
      }
    };

    void loadConfiguration();

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void loadConfiguration();
      }
    };

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );

    return () => {
      active = false;
      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
    };
  }, []);

  const chooseDesktopFolder =
    async (): Promise<WinamaxFolderConfiguration | null> => {
      const desktopBridge = (
        window as unknown as Window & {
          bankrollDesktop?: BankrollDesktopBridge;
        }
      ).bankrollDesktop;

      if (desktopBridge === undefined) {
        throw new Error(
          'La passerelle de l’application Windows est indisponible.',
        );
      }

      const selectedFolder =
        await desktopBridge.selectWinamaxFolder();

      if (selectedFolder === null) {
        return null;
      }

      return {
        directoryPath: selectedFolder.directoryPath,
        directoryName: selectedFolder.directoryName,
        selectedAt: new Date().toISOString(),
        autoScanEnabled: false,
      };
    };

  const chooseBrowserFolder =
    async (): Promise<WinamaxFolderConfiguration> => {
      const handle = await (
        window as unknown as Window & {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker();

      return {
        directoryHandle: handle,
        directoryName: handle.name,
        selectedAt: new Date().toISOString(),
        autoScanEnabled: false,
      };
    };

  const chooseAndImport = async (): Promise<void> => {
    if (!supported || scanning || readOnly) return;

    setScanning(true);
    setMessage(null);

    try {
      const next = isDesktopApp()
        ? await chooseDesktopFolder()
        : await chooseBrowserFolder();

      if (next === null) {
        setMessage('Sélection du dossier annulée.');
        return;
      }

      await winamaxFolderService.saveConfiguration(next);
      setConfiguration(next);

      const result = await winamaxFolderService.scan();
      setConfiguration(result.configuration);

      if (result.fileNames.length === 0) {
        setMessage(
          'Aucun fichier Winamax trouvé dans le dossier sélectionné.',
        );
        return;
      }

      const importableEntries = result.preview.entries.filter(
        (entry) => entry.status !== 'error',
      );

      if (importableEntries.length === 0) {
        setMessage(
          "Aucun nouvel historique de tournois n'a été importé.",
        );
        return;
      }

      const importResult =
        await bankrollService.importWinamaxFolderOperations(
          toWinamaxOperationImports(importableEntries),
          result.sourceFingerprintsByImportKey,
        );

      await onImported();

      if (importResult.importedCount > 0) {
        setMessage(
          `Import réussi. ${importResult.importedCount} session${
            importResult.importedCount > 1 ? 's' : ''
          } ajoutée${importResult.importedCount > 1 ? 's' : ''}.`,
        );
      } else {
        setMessage(
          "Aucun nouvel historique de tournois n'a été importé.",
        );
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        setMessage('Sélection du dossier annulée.');
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "L'import du dossier Winamax a échoué.",
        );
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <section
      className="backup-card winamax-folder-card"
      aria-labelledby="winamax-folder-title"
    >
      <header className="winamax-folder-header">
        <p className="section-kicker">IMPORTATION</p>
        <h2 id="winamax-folder-title">Dossier Winamax</h2>
      </header>

      <aside
        className="winamax-first-import-guide"
        aria-labelledby="winamax-first-import-title"
      >
        <div
          className="winamax-first-import-guide-icon"
          aria-hidden="true"
        >
          <CheckCircle2 size={19} />
        </div>

        <div>
          <h3 id="winamax-first-import-title">
            Avant le premier import
          </h3>

          <ol className="winamax-first-import-steps">
            <li>
              <strong>
                Dans Winamax, ouvrez Paramètres → Tracker →
                Emplacement de l’historique des mains.
              </strong>
            </li>

            <li>
              <strong>
                Repérez le dossier actuellement utilisé par Winamax
                pour enregistrer votre historique.
              </strong>
            </li>

            <li>
              <strong>
                Dans Bankroll Pilot, cliquez sur « Importer dossier
                Winamax ».
              </strong>
            </li>

            <li>
              <strong>
                Sélectionnez exactement le même dossier que celui
                configuré dans Winamax.
              </strong>
            </li>
          </ol>

          <p className="winamax-first-import-step-copy">
            Les fichiers de votre historique de tournois seront alors
            chargés.
          </p>

          <p className="winamax-first-import-step-copy">
            Cette configuration ne se fait qu’une seule fois.
          </p>
        </div>
      </aside>

      {!supported ? (
        <p className="winamax-folder-description">
          {directoryPickerCompatibilityMessage}
        </p>
      ) : configuration === undefined ? (
        <p className="winamax-folder-description">
          Aucun dossier Winamax n’est encore sélectionné.
        </p>
      ) : null}

      {supported && (
        <div className="winamax-folder-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void chooseAndImport()}
            disabled={scanning || readOnly}
          >
            {scanning
              ? 'Import en cours…'
              : 'Importer dossier Winamax'}
          </button>
        </div>
      )}

      {message !== null && (
        <p
          className={`winamax-folder-status system-message ${messageTone}`}
          role={messageTone === 'error' ? 'alert' : 'status'}
        >
          {messageTone === 'success' ? (
            <CheckCircle2 size={16} />
          ) : messageTone === 'error' ? (
            <TriangleAlert size={16} />
          ) : (
            <MinusCircle size={16} />
          )}

          {message}
        </p>
      )}
    </section>
  );
}