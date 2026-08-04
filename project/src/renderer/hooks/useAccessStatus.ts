import { useCallback, useEffect, useState } from 'react';
import { accessService } from '../../application/access/accessService';
import type { AccessState } from '../../domain/access/types';
import type { DevelopmentAccessScenario } from '../../application/access/accessProvider';

type UseAccessStatusResult = {
  access: AccessState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startTrial: () => Promise<void>;
  simulate: (
    scenario: DevelopmentAccessScenario,
  ) => Promise<void>;
};

export const useAccessStatus = (): UseAccessStatusResult => {
  const [access, setAccess] = useState<AccessState | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyAccessOnlyWhenChanged = useCallback(
    (nextAccess: AccessState): void => {
      setAccess((currentAccess) => {
        if (
          currentAccess !== null &&
          JSON.stringify(currentAccess) ===
            JSON.stringify(nextAccess)
        ) {
          return currentAccess;
        }

        return nextAccess;
      });
    },
    [],
  );

  const refreshSilently =
    useCallback(async (): Promise<void> => {
      try {
        const nextAccess =
          await accessService.getAccess();

        applyAccessOnlyWhenChanged(nextAccess);
        setError(null);
      } catch {
        setError(
          'Le statut d’accès est indisponible.',
        );
      }
    }, [applyAccessOnlyWhenChanged]);

  const refresh = useCallback(
    async (): Promise<void> => {
      try {
        const nextAccess =
          await accessService.getAccess();

        applyAccessOnlyWhenChanged(nextAccess);
        setError(null);
      } catch {
        setError(
          'Le statut d’accès est indisponible.',
        );
      } finally {
        setLoading(false);
      }
    },
    [applyAccessOnlyWhenChanged],
  );

  const startTrial =
    useCallback(async (): Promise<void> => {
      setLoading(true);

      try {
        const nextAccess =
          await accessService.startTrial();

        applyAccessOnlyWhenChanged(nextAccess);
        setError(null);
      } catch {
        setError(
          'L’essai gratuit n’a pas pu être démarré.',
        );
      } finally {
        setLoading(false);
      }
    }, [applyAccessOnlyWhenChanged]);

  const simulate = useCallback(
    async (
      scenario: DevelopmentAccessScenario,
    ): Promise<void> => {
      setLoading(true);

      try {
        const nextAccess =
          await accessService.simulate(scenario);

        applyAccessOnlyWhenChanged(nextAccess);
        setError(null);
      } catch {
        setError('La simulation a échoué.');
      } finally {
        setLoading(false);
      }
    },
    [applyAccessOnlyWhenChanged],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });

    const timer = window.setInterval(() => {
      void refreshSilently();
    }, 30_000);

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void refreshSilently();
      }
    };

    document.addEventListener(
      'visibilitychange',
      onVisibility,
    );

    return () => {
      window.clearInterval(timer);

      document.removeEventListener(
        'visibilitychange',
        onVisibility,
      );
    };
  }, [refresh, refreshSilently]);

  return {
    access,
    loading,
    error,
    refresh,
    startTrial,
    simulate,
  };
};