import { useEffect, useRef, useState } from 'react';
import { bankrollService } from '../../application/bankroll/bankrollService';
import { winamaxFolderService } from '../../application/winamax/winamaxFolderService';
import { toWinamaxOperationImports } from '../../features/winamax/toWinamaxOperationImports';

export const winamaxAutoImportIntervalMilliseconds = 5_000;

export type WinamaxAutoImportStatus =
  | { state: 'idle'; checkedAt: null; message: string }
  | {
      state: 'checking';
      checkedAt: string | null;
      message: string;
    }
  | { state: 'ready'; checkedAt: string; message: string }
  | { state: 'waiting'; checkedAt: string; message: string }
  | { state: 'imported'; checkedAt: string; message: string }
  | {
      state: 'permission_required';
      checkedAt: string;
      message: string;
    }
  | { state: 'error'; checkedAt: string; message: string };

const initialStatus: WinamaxAutoImportStatus = {
  state: 'idle',
  checkedAt: null,
  message:
    'L’import automatique démarrera dès qu’un dossier Winamax sera configuré.',
};

export function useWinamaxAutoImport(
  enabled: boolean,
  onImported: () => Promise<void>,
): WinamaxAutoImportStatus {
  const [status, setStatus] =
    useState<WinamaxAutoImportStatus>(initialStatus);

  const onImportedRef = useRef(onImported);
  const automaticFolderSearchAttemptedRef = useRef(false);

  useEffect(() => {
    onImportedRef.current = onImported;
  }, [onImported]);

  useEffect(() => {
    if (!enabled) return undefined;

    let active = true;
    let importing = false;

    const updateStatusOnlyWhenChanged = (
      next: WinamaxAutoImportStatus,
    ): void => {
      setStatus((current) => {
        if (
          current.state === next.state &&
          current.message === next.message
        ) {
          return current;
        }

        return next;
      });
    };

    const importNewHands = async (): Promise<void> => {
      if (
        !active ||
        importing ||
        document.visibilityState === 'hidden'
      ) {
        return;
      }

      importing = true;

      try {
        let configuration =
          await winamaxFolderService.getConfiguration();

        if (!active) return;

        if (
          configuration === undefined &&
          window.bankrollDesktop?.isDesktop === true &&
          !automaticFolderSearchAttemptedRef.current
        ) {
          automaticFolderSearchAttemptedRef.current = true;

          updateStatusOnlyWhenChanged({
            state: 'checking',
            checkedAt: null,
            message:
              'Recherche automatique du dossier Winamax…',
          });

          const detected =
            await window.bankrollDesktop.findWinamaxFolder();

          if (!active) return;

          if (detected !== null) {
            configuration = {
              directoryPath: detected.directoryPath,
              directoryName: detected.directoryName,
              selectedAt: new Date().toISOString(),
              autoScanEnabled: true,
            };

            await winamaxFolderService.saveConfiguration(
              configuration,
            );
          }
        }

        if (configuration === undefined) {
          updateStatusOnlyWhenChanged({
            state: 'idle',
            checkedAt: null,
            message:
              'Aucun dossier Winamax détecté automatiquement. Sélectionnez-le une seule fois dans Import Winamax.',
          });

          return;
        }

        const result =
          await winamaxFolderService.scan(false);

        if (!active) return;

        const importableEntries =
          result.preview.entries.filter(
            (entry) => entry.status !== 'error',
          );

        if (importableEntries.length === 0) {
          /*
           * Vérification silencieuse :
           * aucun changement d’état périodique lorsque rien de
           * nouveau n’est disponible. Cela évite les sursauts
           * visuels toutes les cinq secondes.
           */
          return;
        }

        const importResult =
          await bankrollService.importWinamaxFolderOperations(
            toWinamaxOperationImports(importableEntries),
            result.sourceFingerprintsByImportKey,
          );

        if (importResult.importedCount === 0) {
          return;
        }

        await onImportedRef.current();

        if (!active) return;

        const checkedAt = new Date().toISOString();

        updateStatusOnlyWhenChanged({
          state: 'imported',
          checkedAt,
          message: `${importResult.importedCount} nouvelle${
            importResult.importedCount > 1 ? 's' : ''
          } session${
            importResult.importedCount > 1 ? 's' : ''
          } importée${
            importResult.importedCount > 1 ? 's' : ''
          }.`,
        });
      } catch (error) {
        if (!active) return;

        const checkedAt = new Date().toISOString();
        const message =
          error instanceof Error
            ? error.message
            : 'La vérification automatique a échoué.';

        updateStatusOnlyWhenChanged({
          state: /autorisation|permission/i.test(message)
            ? 'permission_required'
            : 'error',
          checkedAt,
          message,
        });
      } finally {
        importing = false;
      }
    };

    void importNewHands();

    const interval = window.setInterval(
      () => void importNewHands(),
      winamaxAutoImportIntervalMilliseconds,
    );

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void importNewHands();
      }
    };

    const onFocus = (): void => {
      void importNewHands();
    };

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );

    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);

      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );

      window.removeEventListener('focus', onFocus);
    };
  }, [enabled]);

  return enabled ? status : initialStatus;
}