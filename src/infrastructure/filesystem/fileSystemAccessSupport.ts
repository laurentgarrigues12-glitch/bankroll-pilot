export interface WinamaxFolderConfiguration {
  directoryHandle: FileSystemDirectoryHandle;
  directoryName: string;
  selectedAt: string;
  lastScanAt?: string;
  autoScanEnabled: boolean;
}

type PermissionAwareDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (descriptor: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission: (descriptor: { mode: 'read' }) => Promise<PermissionState>;
};

export const isDirectoryPickerSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export const directoryPickerCompatibilityMessage =
  'La sélection d’un dossier nécessite un navigateur compatible Chromium récent.';

export const getDirectoryPermission = async (handle: FileSystemDirectoryHandle): Promise<PermissionState> =>
  (handle as PermissionAwareDirectoryHandle).queryPermission({ mode: 'read' });

export const requestDirectoryPermission = async (handle: FileSystemDirectoryHandle): Promise<PermissionState> =>
  (handle as PermissionAwareDirectoryHandle).requestPermission({ mode: 'read' });
