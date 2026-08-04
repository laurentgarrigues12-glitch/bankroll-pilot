import { canPerform, type AccessAction, type AccessState } from '../../domain/access/types';
import { accessProvider, type DevelopmentAccessScenario } from './accessProvider';

export class AccessDeniedError extends Error { constructor(action: AccessAction) { super(`Action indisponible en mode lecture seule : ${action}.`); this.name = 'AccessDeniedError'; } }

const getAccessFromCurrentUrl = async (): Promise<AccessState> => {
  const url = new URL(window.location.href);
  const ownerToken = url.searchParams.get('owner');
  if (ownerToken === null || accessProvider.activateOwner === undefined) return accessProvider.getAccess();

  const access = await accessProvider.activateOwner(ownerToken);
  url.searchParams.delete('owner');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return access;
};

export const accessService = {
  getAccess: (): Promise<AccessState> => getAccessFromCurrentUrl(),
  startTrial: (): Promise<AccessState> => accessProvider.startTrial(),
  simulate: async (scenario: DevelopmentAccessScenario): Promise<AccessState> => {
    if (!import.meta.env.DEV || accessProvider.simulate === undefined) return accessProvider.getAccess();
    return accessProvider.simulate(scenario);
  },
  assertCanPerform: async (action: AccessAction): Promise<void> => { if (!canPerform(await accessProvider.getAccess(), action)) throw new AccessDeniedError(action); },
};
