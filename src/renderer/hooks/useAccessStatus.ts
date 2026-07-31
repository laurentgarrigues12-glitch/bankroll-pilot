import { useCallback, useEffect, useState } from 'react';
import { accessService } from '../../application/access/accessService';
import type { AccessState } from '../../domain/access/types';
import type { DevelopmentAccessScenario } from '../../application/access/accessProvider';

export const useAccessStatus = (): { access: AccessState | null; loading: boolean; error: string | null; refresh: () => Promise<void>; startTrial: () => Promise<void>; simulate: (scenario: DevelopmentAccessScenario) => Promise<void> } => {
  const [access, setAccess] = useState<AccessState | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (): Promise<void> => { setLoading(true); try { setAccess(await accessService.getAccess()); setError(null); } catch { setError('Le statut d’accès est indisponible.'); } finally { setLoading(false); } }, []);
  const startTrial = useCallback(async (): Promise<void> => { setLoading(true); try { setAccess(await accessService.startTrial()); setError(null); } catch { setError('L’essai gratuit n’a pas pu être démarré.'); } finally { setLoading(false); } }, []);
  const simulate = useCallback(async (scenario: DevelopmentAccessScenario): Promise<void> => { setLoading(true); try { setAccess(await accessService.simulate(scenario)); setError(null); } catch { setError('La simulation a échoué.'); } finally { setLoading(false); } }, []);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  return { access, loading, error, refresh, startTrial, simulate };
};
