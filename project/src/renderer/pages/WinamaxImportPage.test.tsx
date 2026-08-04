import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  getConfiguration: vi.fn(),
  scan: vi.fn(),
  saveConfiguration: vi.fn(),
}));

vi.mock(
  '../../application/winamax/winamaxFolderService',
  () => ({
    winamaxFolderService: {
      getConfiguration: mocks.getConfiguration,
      scan: mocks.scan,
      saveConfiguration: mocks.saveConfiguration,
    },
  }),
);

import { WinamaxImportPage } from './WinamaxImportPage';

const onImported = vi
  .fn()
  .mockResolvedValue(undefined);

describe('WinamaxImportPage', () => {
  beforeEach(() => {
    mocks.getConfiguration
      .mockReset()
      .mockResolvedValue(undefined);

    mocks.scan.mockReset();
    mocks.saveConfiguration.mockReset();
    onImported.mockClear();

    Object.defineProperty(
      window,
      'showDirectoryPicker',
      {
        configurable: true,
        writable: true,
        value: vi.fn(),
      },
    );
  });

  it(
    'shows the Winamax folder import as the only import method',
    async () => {
      render(
        <WinamaxImportPage onImported={onImported} />,
      );

      expect(
        screen.getByRole('heading', {
          name: 'Dossier Winamax',
        }),
      ).not.toBeNull();

      expect(
        screen.getByText('IMPORTATION'),
      ).not.toBeNull();

      expect(
        screen.getByRole('heading', {
          name: 'Avant le premier import',
        }),
      ).not.toBeNull();

      expect(
        screen.getByText(
          /Paramètres → Tracker → Emplacement de l’historique des mains/i,
        ),
      ).not.toBeNull();

      expect(
        screen.getByText(
          /Cette configuration ne se fait qu’une seule fois/i,
        ),
      ).not.toBeNull();

      expect(
        screen.getByRole('button', {
          name: 'Importer dossier Winamax',
        }),
      ).not.toBeNull();

      expect(
        screen.queryByText('Import manuel'),
      ).toBeNull();

      expect(
        screen.queryByText(
          'Importer automatiquement les nouvelles mains',
        ),
      ).toBeNull();

      await waitFor(() => {
        expect(
          mocks.getConfiguration,
        ).toHaveBeenCalled();
      });
    },
  );

  it(
    'disables folder selection in read-only mode',
    () => {
      render(
        <WinamaxImportPage
          onImported={onImported}
          readOnly
        />,
      );

      const button = screen.getByRole(
        'button',
        {
          name: 'Importer dossier Winamax',
        },
      ) as HTMLButtonElement;

      expect(button.disabled).toBe(true);
    },
  );

  it(
    'shows the compatibility explanation without a Chromium directory picker',
    () => {
      Reflect.deleteProperty(
        window,
        'showDirectoryPicker',
      );

      render(
        <WinamaxImportPage onImported={onImported} />,
      );

      expect(
        screen.getByText(
          /application Windows ou un navigateur Chromium récent/i,
        ),
      ).not.toBeNull();

      expect(
        screen.queryByRole('button', {
          name: 'Importer dossier Winamax',
        }),
      ).toBeNull();
    },
  );
});