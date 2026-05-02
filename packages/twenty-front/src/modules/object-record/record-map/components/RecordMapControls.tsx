import { type RecordMapBounds } from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';
import { IconTarget } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type Map } from 'maplibre-gl';

const StyledMapControlContainer = styled.div`
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  position: absolute;
  right: 10px;
  top: 88px;
  z-index: 1;
`;

const StyledMapControlButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.strong};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 29px;
  justify-content: center;
  padding: 0;
  width: 29px;

  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.extraLight};
    cursor: not-allowed;
  }
`;

const StyledSearchAreaButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.strong};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  height: 29px;
  padding: 0 ${themeCssVariables.spacing[3]};
  white-space: nowrap;

  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }
`;

export const RecordMapControls = ({
  canFitToTileBounds,
  map,
  onFitToTileBounds,
  onSearchThisArea,
}: {
  canFitToTileBounds: boolean;
  map: Map | null;
  onFitToTileBounds: () => void;
  onSearchThisArea?: (bounds: RecordMapBounds) => void;
}) => (
  <StyledMapControlContainer>
    <StyledMapControlButton
      aria-label="Zoom to objects"
      disabled={!canFitToTileBounds}
      onClick={onFitToTileBounds}
      title="Zoom to objects"
      type="button"
    >
      <IconTarget size={16} />
    </StyledMapControlButton>
    {isDefined(onSearchThisArea) && (
      <StyledSearchAreaButton
        onClick={() => {
          const currentBounds = map?.getBounds();

          if (!isDefined(currentBounds)) {
            return;
          }

          onSearchThisArea([
            currentBounds.getWest(),
            currentBounds.getSouth(),
            currentBounds.getEast(),
            currentBounds.getNorth(),
          ]);
        }}
        type="button"
      >
        Search this area
      </StyledSearchAreaButton>
    )}
  </StyledMapControlContainer>
);
