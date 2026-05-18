import { createReactBlockSpec } from '@blocknote/react';
import { styled } from '@linaria/react';
import { type MouseEvent } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  APP_BLOCK_DEFAULT_LABEL,
  APP_BLOCK_TYPE,
  createAppBlockDataJson,
  parseAppBlockDataJson,
} from '@/blocknote-editor/blocks/appBlockProof';

const StyledAppBlock = styled.div`
  align-items: stretch;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledAppBlockHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledAppBlockTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: 13px;
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledAppBlockData = styled.code`
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 4px;
  color: ${themeCssVariables.font.color.secondary};
  font-family: monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
  padding: ${themeCssVariables.spacing[1]};
  white-space: pre-wrap;
`;

const StyledAppBlockButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 4px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: 12px;
  height: 24px;
  padding: 0 ${themeCssVariables.spacing[2]};

  &:disabled {
    color: ${themeCssVariables.font.color.tertiary};
    cursor: default;
  }
`;

export const AppBlock = createReactBlockSpec(
  {
    type: APP_BLOCK_TYPE,
    propSchema: {
      label: {
        default: APP_BLOCK_DEFAULT_LABEL,
      },
      dataJson: {
        default: createAppBlockDataJson(),
      },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const parsedDataJson = parseAppBlockDataJson(block.props.dataJson);
      const label = block.props.label || APP_BLOCK_DEFAULT_LABEL;
      const displayDataJson =
        parsedDataJson === undefined
          ? block.props.dataJson
          : JSON.stringify(parsedDataJson, null, 2);

      const handleIncrementClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (!editor.isEditable) {
          return;
        }

        editor.updateBlock(block.id, {
          props: {
            ...block.props,
            dataJson: createAppBlockDataJson((parsedDataJson?.count ?? 0) + 1),
          },
        });
      };

      return (
        <StyledAppBlock>
          <StyledAppBlockHeader>
            <StyledAppBlockTitle>{label}</StyledAppBlockTitle>
            <StyledAppBlockButton
              type="button"
              disabled={!editor.isEditable}
              onClick={handleIncrementClick}
            >
              Increment
            </StyledAppBlockButton>
          </StyledAppBlockHeader>
          <StyledAppBlockData>{displayDataJson}</StyledAppBlockData>
        </StyledAppBlock>
      );
    },
  },
);
