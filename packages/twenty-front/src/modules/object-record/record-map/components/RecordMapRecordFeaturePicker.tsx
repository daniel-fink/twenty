import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { OverlayContainer } from '@/ui/layout/overlay/components/OverlayContainer';
import { createVirtualElementFromContainerOffset } from '@/page-layout/widgets/graph/utils/createVirtualElementFromContainerOffset';
import {
  type RecordMapRecordFeaturePickerItem,
  type RecordMapRecordFeaturePickerState,
} from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { styled } from '@linaria/react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Key } from 'ts-key-enum';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const RECORD_MAP_RECORD_FEATURE_PICKER_WIDTH = 280;
const RECORD_MAP_RECORD_FEATURE_PICKER_MAX_ITEMS = 12;
const RECORD_MAP_RECORD_FEATURE_PICKER_ITEM_HEIGHT = 32;
const RECORD_MAP_RECORD_FEATURE_PICKER_ITEM_GAP = 2;
const RECORD_MAP_RECORD_FEATURE_PICKER_VERTICAL_PADDING = 8;
const RECORD_MAP_RECORD_FEATURE_PICKER_MAX_HEIGHT =
  RECORD_MAP_RECORD_FEATURE_PICKER_MAX_ITEMS *
    RECORD_MAP_RECORD_FEATURE_PICKER_ITEM_HEIGHT +
  (RECORD_MAP_RECORD_FEATURE_PICKER_MAX_ITEMS - 1) *
    RECORD_MAP_RECORD_FEATURE_PICKER_ITEM_GAP +
  RECORD_MAP_RECORD_FEATURE_PICKER_VERTICAL_PADDING;

const StyledSwatch = styled.div<{ color: string }>`
  background: ${({ color }) => color};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xs};
  height: 12px;
  width: 12px;
`;

type RecordMapRecordFeaturePickerProps = {
  containerElement: HTMLElement | null;
  featurePicker: RecordMapRecordFeaturePickerState | null;
  objectNameSingular?: string;
  onClose: () => void;
  onSelectFeature: (item: RecordMapRecordFeaturePickerItem) => void;
};

export const RecordMapRecordFeaturePicker = ({
  containerElement,
  featurePicker,
  objectNameSingular,
  onClose,
  onSelectFeature,
}: RecordMapRecordFeaturePickerProps) => {
  const [floatingElement, setFloatingElementNode] =
    useState<HTMLDivElement | null>(null);
  const referenceElement = useMemo(() => {
    if (containerElement === null || featurePicker === null) {
      return null;
    }

    return createVirtualElementFromContainerOffset(
      containerElement,
      featurePicker.position.x,
      featurePicker.position.y,
    );
  }, [containerElement, featurePicker]);

  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: referenceElement,
    },
    middleware: [offset(8), flip(), shift()],
    placement: 'bottom-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  });

  const setFloatingElement = useCallback(
    (node: HTMLDivElement | null) => {
      setFloatingElementNode(node);
      refs.setFloating(node);
    },
    [refs],
  );

  useEffect(() => {
    if (featurePicker === null) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (floatingElement?.contains(event.target as Node)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === Key.Escape) {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown, {
      capture: true,
    });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, {
        capture: true,
      });
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [featurePicker, floatingElement, onClose]);

  if (featurePicker === null || containerElement === null) {
    return null;
  }

  return (
    <FloatingPortal>
      <OverlayContainer ref={setFloatingElement} style={floatingStyles}>
        <DropdownContent widthInPixels={RECORD_MAP_RECORD_FEATURE_PICKER_WIDTH}>
          <DropdownMenuItemsContainer
            maxHeight={RECORD_MAP_RECORD_FEATURE_PICKER_MAX_HEIGHT}
          >
            {featurePicker.items.map((item) => (
              <MenuItem
                key={item.recordId}
                LeftComponent={<StyledSwatch color={item.swatchColor} />}
                contextualText={objectNameSingular}
                onClick={() => onSelectFeature(item)}
                text={item.title}
              />
            ))}
          </DropdownMenuItemsContainer>
        </DropdownContent>
      </OverlayContainer>
    </FloatingPortal>
  );
};
