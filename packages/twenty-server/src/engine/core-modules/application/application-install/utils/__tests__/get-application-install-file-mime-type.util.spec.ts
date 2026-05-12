import { FileFolder } from 'twenty-shared/types';

import { getApplicationInstallFileMimeType } from 'src/engine/core-modules/application/application-install/utils/get-application-install-file-mime-type.util';

describe('getApplicationInstallFileMimeType', () => {
  it.each([
    ['public/app.js', 'text/javascript'],
    ['public/app.mjs', 'text/javascript'],
    ['public/app.css', 'text/css'],
    ['public/font.woff', 'font/woff'],
    ['public/font.woff2', 'font/woff2'],
    ['public/data.json', 'application/json'],
  ])('returns the MIME type for public asset %s', (relativePath, mimeType) => {
    expect(
      getApplicationInstallFileMimeType({
        fileFolder: FileFolder.PublicAsset,
        relativePath,
      }),
    ).toBe(mimeType);
  });

  it('returns undefined for unknown public asset extensions', () => {
    expect(
      getApplicationInstallFileMimeType({
        fileFolder: FileFolder.PublicAsset,
        relativePath: 'public/asset.twenty-unknown',
      }),
    ).toBeUndefined();
  });

  it.each([
    FileFolder.Dependencies,
    FileFolder.Source,
    FileFolder.BuiltLogicFunction,
    FileFolder.BuiltFrontComponent,
  ])('returns undefined for non-public asset folder %s', (fileFolder) => {
    expect(
      getApplicationInstallFileMimeType({
        fileFolder,
        relativePath: 'public/app.js',
      }),
    ).toBeUndefined();
  });
});
