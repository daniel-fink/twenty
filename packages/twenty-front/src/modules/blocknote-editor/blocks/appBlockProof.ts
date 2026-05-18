export const APP_BLOCK_TYPE = 'appBlock';

export const APP_BLOCK_DEFAULT_LABEL = 'App Block Proof';

export type AppBlockProofBlock = {
  id: string;
  type: typeof APP_BLOCK_TYPE;
  props: {
    label: string;
    dataJson: string;
  };
  content: [];
  children: [];
};

type AppBlockProofData = {
  count: number;
};

export const createAppBlockDataJson = (count = 0) => JSON.stringify({ count });

export const parseAppBlockDataJson = (
  dataJson: string,
): AppBlockProofData | undefined => {
  try {
    const parsedDataJson = JSON.parse(dataJson);

    if (
      typeof parsedDataJson === 'object' &&
      parsedDataJson !== null &&
      typeof parsedDataJson.count === 'number'
    ) {
      return {
        count: parsedDataJson.count,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const createAppBlockProofBlocks = (
  count: number,
): AppBlockProofBlock[] =>
  Array.from(
    { length: count },
    (_, index): AppBlockProofBlock => ({
      id: `app-block-proof-${index + 1}`,
      type: APP_BLOCK_TYPE,
      props: {
        label: `${APP_BLOCK_DEFAULT_LABEL} ${index + 1}`,
        dataJson: createAppBlockDataJson(),
      },
      content: [],
      children: [],
    }),
  );
