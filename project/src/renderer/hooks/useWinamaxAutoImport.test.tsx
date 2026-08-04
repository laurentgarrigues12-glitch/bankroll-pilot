import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getConfiguration: vi.fn(),
  scan: vi.fn(),
  importWinamaxFolderOperations: vi.fn(),
  toWinamaxOperationImports: vi.fn(),
}));

vi.mock('../../application/winamax/winamaxFolderService', () => ({
  winamaxFolderService: {
    getConfiguration: mocks.getConfiguration,
    scan: mocks.scan,
  },
}));

vi.mock('../../application/bankroll/bankrollService', () => ({
  bankrollService: {
    importWinamaxFolderOperations: mocks.importWinamaxFolderOperations,
  },
}));

vi.mock('../../features/winamax/toWinamaxOperationImports', () => ({
  toWinamaxOperationImports: mocks.toWinamaxOperationImports,
}));

import { useWinamaxAutoImport, winamaxAutoImportIntervalMilliseconds } from './useWinamaxAutoImport';

const validEntry = {
  status: 'valid',
  importKey: 'tournament:auto:hero',
};

const scanResult = {
  preview: { entries: [validEntry], invalidFileNames: [] },
  sourceFingerprintsByImportKey: { 'tournament:auto:hero': ['history|1|1'] },
};

const flushAsyncWork = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('useWinamaxAutoImport', () => {
  let setIntervalSpy: ReturnType<typeof vi.spyOn>;
  let clearIntervalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setIntervalSpy = vi.spyOn(window, 'setInterval');
    clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    mocks.getConfiguration.mockReset().mockResolvedValue({ autoScanEnabled: true });
    mocks.scan.mockReset().mockResolvedValue(scanResult);
    mocks.toWinamaxOperationImports.mockReset().mockReturnValue([{ importKey: 'tournament:auto:hero' }]);
    mocks.importWinamaxFolderOperations.mockReset().mockResolvedValue({ importedCount: 1, duplicateCount: 0 });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('checks immediately, imports newly detected sessions and refreshes the bankroll', async () => {
    const onImported = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useWinamaxAutoImport(true, onImported));

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), winamaxAutoImportIntervalMilliseconds);

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));

    expect(mocks.scan).toHaveBeenCalledWith(false);
    expect(mocks.importWinamaxFolderOperations).toHaveBeenCalledWith(
      [{ importKey: 'tournament:auto:hero' }],
      scanResult.sourceFingerprintsByImportKey,
    );
    expect(result.current.state).toBe('imported');

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('keeps the automatic scan silent when no completed importable session is available', async () => {
    mocks.scan.mockResolvedValue({
      preview: { entries: [{ status: 'error' }], invalidFileNames: [] },
      sourceFingerprintsByImportKey: {},
    });
    const onImported = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useWinamaxAutoImport(true, onImported));

    await waitFor(() => expect(mocks.scan).toHaveBeenCalledTimes(1));

    expect(result.current.state).toBe('idle');
    expect(result.current.message).toMatch(/dossier Winamax sera configuré/i);
    expect(mocks.importWinamaxFolderOperations).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('reports permission errors instead of failing silently', async () => {
    mocks.scan.mockRejectedValue(new Error('Lâ€™autorisation de lecture du dossier Winamax a Ã©tÃ© refusÃ©e.'));
    const { result } = renderHook(() => useWinamaxAutoImport(true, vi.fn().mockResolvedValue(undefined)));

    await waitFor(() => expect(result.current.state).toBe('permission_required'));

    expect(result.current.message).toMatch(/autorisation/i);
  });

  it('keeps automatic import active for a legacy folder configuration', async () => {
    mocks.getConfiguration.mockResolvedValue({ autoScanEnabled: false });
    const onImported = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useWinamaxAutoImport(true, onImported));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));

    expect(mocks.scan).toHaveBeenCalledWith(false);
  });


  it('does not recreate the polling interval when the refresh callback identity changes', async () => {
    const firstOnImported = vi.fn().mockResolvedValue(undefined);
    const secondOnImported = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(
      ({ onImported }) => useWinamaxAutoImport(true, onImported),
      { initialProps: { onImported: firstOnImported } },
    );

    await waitFor(() => expect(firstOnImported).toHaveBeenCalledTimes(1));
    const intervalCallsAfterMount = setIntervalSpy.mock.calls.length;
    const clearCallsAfterMount = clearIntervalSpy.mock.calls.length;

    rerender({ onImported: secondOnImported });

    expect(setIntervalSpy).toHaveBeenCalledTimes(intervalCallsAfterMount);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(clearCallsAfterMount);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(clearCallsAfterMount + 1);
  });

  it('checks again when the user returns to the Bankroll Pilot tab', async () => {
    const onImported = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useWinamaxAutoImport(true, onImported));
    await waitFor(() => expect(mocks.scan).toHaveBeenCalledTimes(1));

    mocks.importWinamaxFolderOperations.mockResolvedValue({ importedCount: 0, duplicateCount: 1 });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await flushAsyncWork();
    });

    expect(mocks.scan).toHaveBeenCalledTimes(2);
  });
});



