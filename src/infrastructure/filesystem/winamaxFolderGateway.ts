const supported = (name: string): boolean => /\.(txt|csv)$/i.test(name);

export interface WinamaxFolderFile {
  relativeName: string;
  file: File;
}

export const fingerprintWinamaxFile = (file: File, relativeName: string): string => `${relativeName.toLocaleLowerCase()}|${file.size}|${file.lastModified}`;

export const readWinamaxFolder = async (directory: FileSystemDirectoryHandle): Promise<WinamaxFolderFile[]> => {
  const files: WinamaxFolderFile[] = [];
  const visit = async (handle: FileSystemDirectoryHandle, prefix = ''): Promise<void> => {
    for await (const entry of handle.values()) {
      const relativeName = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.kind === 'directory') await visit(entry, relativeName);
      if (entry.kind === 'file' && supported(entry.name)) files.push({ relativeName, file: await entry.getFile() });
    }
  };
  await visit(directory);
  return files;
};
