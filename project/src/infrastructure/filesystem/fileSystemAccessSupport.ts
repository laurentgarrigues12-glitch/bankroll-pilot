export interface WinamaxFolderConfiguration {
  directoryHandle?: FileSystemDirectoryHandle;
  directoryPath?: string;
  directoryName: string;
  selectedAt: string;
  lastScanAt?: string;
  autoScanEnabled: boolean;
}

type PermissionAwareDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (descriptor: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission: (descriptor: { mode: 'read' }) => Promise<PermissionState>;
};

export const isDesktopApp = (): boolean => typeof window !== 'undefined' && window.bankrollDesktop?.isDesktop === true;
export const isDirectoryPickerSupported = (): boolean => isDesktopApp() || (typeof window !== 'undefined' && 'showDirectoryPicker' in window);
export const directoryPickerCompatibilityMessage = 'La sélection d’un dossier nécessite l’application Windows ou un navigateur Chromium récent.';

export const getDirectoryPermission = async (handle?: FileSystemDirectoryHandle): Promise<PermissionState> => {
  if (isDesktopApp()) return 'granted';
  if (handle === undefined) return 'denied';
  return (handle as PermissionAwareDirectoryHandle).queryPermission({ mode: 'read' });
};
export const requestDirectoryPermission = async (handle?: FileSystemDirectoryHandle): Promise<PermissionState> => {
  if (isDesktopApp()) return 'granted';
  if (handle === undefined) return 'denied';
  return (handle as PermissionAwareDirectoryHandle).requestPermission({ mode: 'read' });
};
