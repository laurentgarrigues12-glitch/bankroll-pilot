import type { WinamaxFolderConfiguration } from './fileSystemAccessSupport';

const supported = (name: string): boolean => /\.(txt|csv)$/i.test(name);

export interface WinamaxFolderFile {
  relativeName: string;
  file: File;
}

interface DesktopWinamaxFile {
  relativeName: string;
  name: string;
  size: number;
  lastModified: number;
  content: string;
}

interface BankrollDesktopBridge {
  readWinamaxFolder: (
    directoryPath: string,
  ) => Promise<DesktopWinamaxFile[]>;
}

export const fingerprintWinamaxFile = (
  file: File,
  relativeName: string,
): string =>
  `${relativeName.toLocaleLowerCase()}|${file.size}|${file.lastModified}`;

export const readWinamaxFolder = async (
  source: WinamaxFolderConfiguration | FileSystemDirectoryHandle,
): Promise<WinamaxFolderFile[]> => {
  const configuration: WinamaxFolderConfiguration =
    'directoryName' in source
      ? source
      : {
          directoryHandle: source,
          directoryName: source.name,
          selectedAt: '',
          autoScanEnabled: false,
        };

  if (configuration.directoryPath !== undefined) {
    const desktopBridge = (
      window as unknown as Window & {
        bankrollDesktop?: BankrollDesktopBridge;
      }
    ).bankrollDesktop;

    if (desktopBridge === undefined) {
      throw new Error(
        'La passerelle de lecture de l’application Windows est indisponible.',
      );
    }

    const desktopFiles = await desktopBridge.readWinamaxFolder(
      configuration.directoryPath,
    );

    return desktopFiles
      .filter((entry) => supported(entry.name))
      .map((entry) => ({
        relativeName: entry.relativeName,
        file: new File([entry.content], entry.name, {
          type: 'text/plain',
          lastModified: entry.lastModified,
        }),
      }));
  }

  if (configuration.directoryHandle === undefined) {
    throw new Error(
      'Le dossier Winamax doit être sélectionné à nouveau.',
    );
  }

  const files: WinamaxFolderFile[] = [];

  const visit = async (
    handle: FileSystemDirectoryHandle,
    prefix = '',
  ): Promise<void> => {
    for await (const [name, entry] of handle.entries()) {
      const relativeName =
        prefix === '' ? name : `${prefix}/${name}`;

      if (entry.kind === 'directory') {
        await visit(entry, relativeName);
      }

      if (entry.kind === 'file' && supported(name)) {
        files.push({
          relativeName,
          file: await entry.getFile(),
        });
      }
    }
  };

  await visit(configuration.directoryHandle);

  return files;
};