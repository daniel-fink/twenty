import {
  APP_BLOCK_TYPE,
  createAppBlockProofBlocks,
  parseAppBlockDataJson,
} from '@/blocknote-editor/blocks/appBlockProof';

describe('appBlockProof', () => {
  it('creates a 50 block proof fixture', () => {
    const blocks = createAppBlockProofBlocks(50);

    expect(blocks).toHaveLength(50);
    expect(blocks.every((block) => block.type === APP_BLOCK_TYPE)).toBe(true);
    expect(
      blocks.every(
        (block) => parseAppBlockDataJson(block.props.dataJson)?.count === 0,
      ),
    ).toBe(true);
  });

  it('returns undefined for invalid dataJson', () => {
    expect(parseAppBlockDataJson('invalid json')).toBeUndefined();
    expect(parseAppBlockDataJson('{}')).toBeUndefined();
  });
});
