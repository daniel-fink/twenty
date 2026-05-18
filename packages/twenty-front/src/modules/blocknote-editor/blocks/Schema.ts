import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from '@blocknote/core';

import { AppBlock } from '@/blocknote-editor/blocks/AppBlock';
import { FileBlock } from '@/blocknote-editor/blocks/FileBlock';
import { MentionInlineContent } from '@/blocknote-editor/blocks/MentionInlineContent';

export const BLOCK_SCHEMA = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    appBlock: AppBlock(),
    file: FileBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: MentionInlineContent,
  },
});
