import { useEffect, useState } from 'react';

import { createAppBlockProofBlocks } from '@/blocknote-editor/blocks/appBlockProof';
import { type BLOCK_SCHEMA } from '@/blocknote-editor/blocks/Schema';

const APP_BLOCK_PROOF_DEV_SEED_QUERY_PARAM = 'twentyAppBlockProofSeed';
const APP_BLOCK_PROOF_DEV_READONLY_QUERY_PARAM = 'twentyAppBlockProofReadonly';
const MAX_APP_BLOCK_PROOF_DEV_SEED_COUNT = 100;

export const isAppBlockProofReadonlyInDev = () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false;
  }

  const readonlyParam = new URLSearchParams(window.location.search).get(
    APP_BLOCK_PROOF_DEV_READONLY_QUERY_PARAM,
  );

  return readonlyParam === '1' || readonlyParam === 'true';
};

export const useSeedAppBlockProofInDev = ({
  editor,
  onSeed,
}: {
  editor: typeof BLOCK_SCHEMA.BlockNoteEditor;
  onSeed: (blocknote: string) => Promise<void>;
}) => {
  const [hasSeededAppBlockProof, setHasSeededAppBlockProof] = useState(false);

  useEffect(() => {
    if (
      !import.meta.env.DEV ||
      hasSeededAppBlockProof ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const seedCountParam = new URLSearchParams(window.location.search).get(
      APP_BLOCK_PROOF_DEV_SEED_QUERY_PARAM,
    );

    if (seedCountParam === null) {
      return;
    }

    const seedCount = Number(seedCountParam);

    if (
      !Number.isInteger(seedCount) ||
      seedCount < 1 ||
      seedCount > MAX_APP_BLOCK_PROOF_DEV_SEED_COUNT
    ) {
      return;
    }

    // Dev-only proof harness: normal UI has no appBlock insertion path.
    const appBlockProofBlocks = createAppBlockProofBlocks(
      seedCount,
    ) as unknown as typeof editor.document;

    editor.replaceBlocks(editor.document, appBlockProofBlocks);
    setHasSeededAppBlockProof(true);

    void onSeed(JSON.stringify(appBlockProofBlocks));

    const currentUrl = new URL(window.location.href);

    currentUrl.searchParams.delete(APP_BLOCK_PROOF_DEV_SEED_QUERY_PARAM);
    window.history.replaceState(
      window.history.state,
      '',
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
  }, [editor, hasSeededAppBlockProof, onSeed]);
};
