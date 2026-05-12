import { lookup } from 'mrmime';
import { FileFolder } from 'twenty-shared/types';

export const getApplicationInstallFileMimeType = ({
  fileFolder,
  relativePath,
}: {
  fileFolder: FileFolder;
  relativePath: string;
}): string | undefined => {
  if (fileFolder !== FileFolder.PublicAsset) {
    return undefined;
  }

  return lookup(relativePath) || undefined;
};
