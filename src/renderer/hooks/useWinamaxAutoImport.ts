import { useEffect, useRef, useState } from 'react';
import { bankrollService } from '../../application/bankroll/bankrollService';
import { winamaxFolderService } from '../../application/winamax/winamaxFolderService';
import { toWinamaxOperationImports } from '../../features/winamax/toWinamaxOperationImports';

export const winamaxAutoImportIntervalMilliseconds = 15_000;

export type WinamaxAutoImportStatus =
  | { state: 'idle'; checkedAt: null; message: string }
  | { state: 'checking'; checkedAt: string | null; message: string }
  | { state: 'ready'; checkedAt: string; message: string }
  | { state: 'waiting'; checkedAt: string; message: string }
  | { state: 'imported'; checkedAt: string; message: string }
  | { state: 'permission_required'; checkedAt: string; message: string }
  | { state: 'error'; checkedAt: string; message: string };

const initialStatus: WinamaxAutoImportStatus = {
  state: 'idle',
  checkedAt: null,
  message: 'L’import automatique démarrera dès qu’un dossier Winamax sera configuré.',
};

export function useWinamaxAutoImport(
  enabled: boolean,
  onImported: () => Promise<void>,
): WinamaxAutoImportStatus {
  const [status, setStatus] = useState<WinamaxAutoImportStatus>(initialStatus);
  const onImportedRef = useRef(onImported);

  useEffect(() => {
    onImportedRef.current = onImported;
  }, [onImported]);

  useEffect(() => {
    if (!enabled) return undefined;

    let active = true;
    let importing = false;

    const importNewHands = async (): Promise<void> => {
      if (!active || importing || document.visibilityState === 'hidden') return;

      importing = true;
      setStatus((current) => ({
        state: 'checking',
        checkedAt: current.checkedAt,
        message: 'Vérification des nouvelles mains…',
      }));

      try {
        const configuration = await winamaxFolderService.getConfiguration();
        if (!active) return;

        if (configuration === undefined) {
          setStatus(initialStatus);
          return;
        }


        const result = await winamaxFolderService.scan(false);
        if (!active) return;

        const checkedAt = new Date().toISOString();
        const importableEntries = result.preview.entries.filter((entry) => entry.status !== 'error');

        if (importableEntries.length === 0) {
          if (result.preview.entries.length > 0 || result.preview.invalidFileNames.length > 0) {
            setStatus({
              state: 'waiting',
              checkedAt,
              message: 'Des fichiers ont été détectés, mais aucune session terminée n’est encore importable.',
            });
          } else {
            setStatus({
              state: 'ready',
              checkedAt,
              message: 'Aucune nouvelle main à importer.',
            });
          }
          return;
        }

        const importResult = await bankrollService.importWinamaxFolderOperations(
          toWinamaxOperationImports(importableEntries),
          result.sourceFingerprintsByImportKey,
        );

        if (importResult.importedCount > 0) {
          await onImportedRef.current();
          if (!active) return;
          setStatus({
            state: 'imported',
            checkedAt,
            message: `${importResult.importedCount} nouvelle${importResult.importedCount > 1 ? 's' : ''} session${importResult.importedCount > 1 ? 's' : ''} importée${importResult.importedCount > 1 ? 's' : ''}.`,
          });
          return;
        }

        setStatus({
          state: 'ready',
          checkedAt,
          message: 'Aucune nouvelle main à importer.',
        });
      } catch (error) {
        if (!active) return;
        const checkedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : 'La vérification automatique a échoué.';
        setStatus({
          state: /autorisation|permission/i.test(message) ? 'permission_required' : 'error',
          checkedAt,
          message,
        });
      } finally {
        importing = false;
      }
    };

    void importNewHands();
    const interval = window.setInterval(() => void importNewHands(), winamaxAutoImportIntervalMilliseconds);
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void importNewHands();
    };
    const onFocus = (): void => void importNewHands();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled]);

  return enabled ? status : initialStatus;
}
