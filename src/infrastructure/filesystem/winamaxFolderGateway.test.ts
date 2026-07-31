import { describe, expect, it } from 'vitest';
import { fingerprintWinamaxFile, readWinamaxFolder } from './winamaxFolderGateway';

const file = (name: string, content = 'x', lastModified = 10): File => new File([content], name, { lastModified });
const directory = (name: string, entries: FileSystemHandle[]): FileSystemDirectoryHandle => ({ kind: 'directory', name, values: async function* (): AsyncIterableIterator<FileSystemHandle> { yield* entries; } } as unknown as FileSystemDirectoryHandle);
const fileHandle = (entry: File): FileSystemFileHandle => ({ kind: 'file', name: entry.name, getFile: async () => entry } as FileSystemFileHandle);

describe('winamaxFolderGateway', () => {
  it('reads supported files recursively and produces stable fingerprints', async () => {
    const history = file('history.txt', 'history', 20);
    const csv = file('transactions.csv', 'date;type', 30);
    const root = directory('root', [fileHandle(history), directory('nested', [fileHandle(csv), fileHandle(file('notes.pdf'))])]);
    expect((await readWinamaxFolder(root)).map(({ relativeName }) => relativeName)).toEqual(['history.txt', 'nested/transactions.csv']);
    expect(fingerprintWinamaxFile(history, 'Nested/HISTORY.txt')).toBe('nested/history.txt|7|20');
  });
});
