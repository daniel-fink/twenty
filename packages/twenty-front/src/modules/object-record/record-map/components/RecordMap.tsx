import { REACT_APP_MAP_VIEW_STYLE_URL } from '~/config';

import { RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT } from '@/object-record/record-map/constants/record-map-contribution.constants';
import { RecordMapControls } from '@/object-record/record-map/components/RecordMapControls';
import { RecordMapRecordFeaturePicker } from '@/object-record/record-map/components/RecordMapRecordFeaturePicker';
import { useOpenRecordFromIndexView } from '@/object-record/record-index/hooks/useOpenRecordFromIndexView';
import { useMapLibreMap } from '@/object-record/record-map/hooks/useMapLibreMap';
import { useMapTileMetadata } from '@/object-record/record-map/hooks/useMapTileMetadata';
import { useRecordMapAddressMarkers } from '@/object-record/record-map/hooks/useRecordMapAddressMarkers';
import { useRecordMapContributedLayers } from '@/object-record/record-map/hooks/useRecordMapContributedLayers';
import { useRecordMapContributionFrontComponentResolver } from '@/object-record/record-map/hooks/useRecordMapContributionFrontComponentResolver';
import { useRecordMapContributions } from '@/object-record/record-map/hooks/useRecordMapContributions';
import { useRecordMapVectorTileLayers } from '@/object-record/record-map/hooks/useRecordMapVectorTileLayers';
import { type RecordMapSelectedContributionFeature } from '@/object-record/record-map/types/RecordMapContribution';
import { type RecordMapContributedFeaturePickerItem } from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { type RecordMapTileSource } from '@/object-record/record-map/types/RecordMapTileSource';
import {
  getPaddedRecordMapBounds,
  type RecordMapBounds,
} from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { getNextRecordMapContributionSelection } from '@/object-record/record-map/utils/getNextRecordMapContributionSelection';
import {
  readRecordMapCamera,
  writeRecordMapCamera,
} from '@/object-record/record-map/utils/recordMapCamera';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useOpenFrontComponentInSidePanel } from '@/side-panel/hooks/useOpenFrontComponentInSidePanel';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useDebouncedCallback } from 'use-debounce';
import { IconMap } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import 'maplibre-gl/dist/maplibre-gl.css';

const StyledContainer = styled.div`
  background: ${themeCssVariables.color.gray10};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
  position: relative;
  width: 100%;

  .maplibregl-ctrl-logo {
    display: none;
  }
`;

const StyledMapCanvas = styled.div`
  height: 100%;
  width: 100%;
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  height: 100%;
  justify-content: center;
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

const RECORD_MAP_MULTI_SELECT_LIMIT = 10;
const RECORD_MAP_SELECTED_FEATURES_PARAM = 'selectedFeatures';

const serializeSelectedFeatures = (
  items: RecordMapContributedFeaturePickerItem[],
) =>
  JSON.stringify(
    items.map((item) => ({
      featureId: item.featureId,
      layerId: item.layerId,
      title: item.title,
      viewId: item.viewId,
    })),
  );

export const RecordMap = ({
  loading,
  objectNameSingular,
  recordMapPoints,
  tileSource,
  onSearchThisArea,
}: {
  loading: boolean;
  objectNameSingular?: string;
  recordMapPoints: RecordMapPoint[];
  tileSource?: RecordMapTileSource;
  onSearchThisArea?: (bounds: RecordMapBounds) => void;
}) => {
  const [mapContainerElement, setMapContainerElement] =
    useState<HTMLDivElement | null>(null);
  const [hasAutoFitTileBounds, setHasAutoFitTileBounds] = useState(false);
  const [hasUserMovedTileMap, setHasUserMovedTileMap] = useState(false);
  // oxlint-disable-next-line twenty/no-state-useref
  const isFittingTileBoundsRef = useRef(false);
  // oxlint-disable-next-line twenty/no-state-useref
  const shouldPersistNextMoveRef = useRef(false);
  const { openRecordFromIndexView } = useOpenRecordFromIndexView();
  const { closeSidePanelMenu } = useSidePanelMenu();
  const { enqueueErrorSnackBar, enqueueWarningSnackBar } = useSnackBar();
  const { openFrontComponentInSidePanel } = useOpenFrontComponentInSidePanel();
  const [selectedContributionItems, setSelectedContributionItems] = useState<
    RecordMapContributedFeaturePickerItem[]
  >([]);
  const [activeContributionFeatureId, setActiveContributionFeatureId] =
    useState<string | null>(null);

  const hasMapStyle = REACT_APP_MAP_VIEW_STYLE_URL !== '';
  const shouldRenderMap =
    hasMapStyle &&
    (isDefined(tileSource) || loading || recordMapPoints.length > 0);
  const tileSourceViewId = tileSource?.viewId;
  const tileSourceFilter = JSON.stringify(tileSource?.filter ?? {});
  const persistedMapCamera = useMemo(
    () => readRecordMapCamera(tileSourceViewId),
    [tileSourceViewId],
  );
  const { map } = useMapLibreMap({
    initialCamera: persistedMapCamera,
    mapContainerElement,
    shouldRenderMap,
  });
  const { tileBounds, tileJson } = useMapTileMetadata({
    tileSourceFilter,
    tileSourceViewId,
  });
  const { layerContributions, refreshMapContributions } =
    useRecordMapContributions({
      tileSourceViewId,
    });
  const selectedContributionFeature = useMemo(() => {
    if (
      selectedContributionItems.length === 0 ||
      !isDefined(activeContributionFeatureId)
    ) {
      return null;
    }

    const activeItem = selectedContributionItems.find(
      (item) => item.featureId === activeContributionFeatureId,
    );

    if (!isDefined(activeItem)) {
      return null;
    }

    return {
      activeFeatureId: activeItem.featureId,
      contributionId: activeItem.contributionId,
      featureIds: selectedContributionItems.map((item) => item.featureId),
    } satisfies RecordMapSelectedContributionFeature;
  }, [activeContributionFeatureId, selectedContributionItems]);
  const { renderedContributionLayers } = useRecordMapContributedLayers({
    layerContributions,
    map,
    selectedContributionFeature,
  });
  const resolveFrontComponentId =
    useRecordMapContributionFrontComponentResolver();

  const handleRecordClick = useCallback(
    (recordId: string) => {
      setSelectedContributionItems([]);
      setActiveContributionFeatureId(null);
      openRecordFromIndexView({ recordId });
    },
    [openRecordFromIndexView],
  );

  const handleContributedFeatureClick = useCallback(
    async (
      item: RecordMapContributedFeaturePickerItem,
      options?: { shouldToggleSelection?: boolean },
    ) => {
      const featureSelectionAction = item.contribution.featureSelectionAction;

      if (featureSelectionAction?.type !== 'OPEN_FRONT_COMPONENT') {
        return;
      }

      const frontComponentId = resolveFrontComponentId(featureSelectionAction);

      if (!isDefined(frontComponentId)) {
        enqueueErrorSnackBar({
          message: 'Unable to open map feature.',
        });

        return;
      }

      const openSelectionInSidePanel = (
        nextItems: RecordMapContributedFeaturePickerItem[],
        activeItem: RecordMapContributedFeaturePickerItem,
      ) => {
        const pageTitle =
          nextItems.length > 1
            ? `${nextItems.length} ${activeItem.contribution.displayName} selected`
            : activeItem.title;

        openFrontComponentInSidePanel({
          frontComponentId,
          pageIcon: IconMap,
          pageTitle,
          params: {
            ...featureSelectionAction.params,
            featureId: activeItem.featureId,
            layerId: activeItem.layerId,
            [RECORD_MAP_SELECTED_FEATURES_PARAM]:
              serializeSelectedFeatures(nextItems),
            viewId: activeItem.viewId,
          },
          resetNavigationStack: true,
        });
      };

      const nextSelection = getNextRecordMapContributionSelection({
        activeFeatureId: activeContributionFeatureId,
        currentItems: selectedContributionItems,
        item,
        maxSelectedItems: RECORD_MAP_MULTI_SELECT_LIMIT,
        shouldToggleSelection: options?.shouldToggleSelection === true,
      });

      if (nextSelection.status === 'limit-exceeded') {
        enqueueWarningSnackBar({
          message: `You can select up to ${RECORD_MAP_MULTI_SELECT_LIMIT} ${item.contribution.displayName}.`,
        });

        return;
      }

      if (nextSelection.status === 'cleared') {
        setSelectedContributionItems([]);
        setActiveContributionFeatureId(null);
        closeSidePanelMenu();

        return;
      }

      if (!isDefined(nextSelection.activeItem)) {
        return;
      }

      setSelectedContributionItems(nextSelection.items);
      setActiveContributionFeatureId(nextSelection.activeItem.featureId);
      openSelectionInSidePanel(nextSelection.items, nextSelection.activeItem);
    },
    [
      activeContributionFeatureId,
      closeSidePanelMenu,
      enqueueErrorSnackBar,
      enqueueWarningSnackBar,
      openFrontComponentInSidePanel,
      resolveFrontComponentId,
      selectedContributionItems,
    ],
  );

  const persistRecordMapCamera = useDebouncedCallback(
    ({
      bearing,
      latitude,
      longitude,
      pitch,
      viewId,
      zoom,
    }: {
      bearing: number;
      latitude: number;
      longitude: number;
      pitch: number;
      viewId: string;
      zoom: number;
    }) => {
      writeRecordMapCamera({
        camera: {
          bearing,
          latitude,
          longitude,
          pitch,
          updatedAt: new Date().toISOString(),
          zoom,
        },
        viewId,
      });
    },
    400,
  );

  const persistCurrentMapCamera = useCallback(() => {
    if (!isDefined(map) || !isDefined(tileSourceViewId)) {
      return;
    }

    const center = map.getCenter();

    persistRecordMapCamera({
      bearing: map.getBearing(),
      latitude: center.lat,
      longitude: center.lng,
      pitch: map.getPitch(),
      viewId: tileSourceViewId,
      zoom: map.getZoom(),
    });
  }, [map, persistRecordMapCamera, tileSourceViewId]);

  const fitMapToTileBounds = useCallback(
    (options?: { persistCamera: boolean }) => {
      if (!isDefined(map) || !isDefined(tileBounds?.bounds)) {
        return;
      }

      isFittingTileBoundsRef.current = true;

      if (options?.persistCamera === true) {
        setHasUserMovedTileMap(true);
        shouldPersistNextMoveRef.current = true;
      }

      map.once('moveend', () => {
        isFittingTileBoundsRef.current = false;
      });
      window.setTimeout(() => {
        isFittingTileBoundsRef.current = false;
      }, 750);

      map.fitBounds(getPaddedRecordMapBounds(tileBounds.bounds), {
        padding: 64,
        maxZoom: 12,
        essential: true,
      });
    },
    [map, tileBounds],
  );

  useEffect(() => {
    setHasAutoFitTileBounds(false);
    setHasUserMovedTileMap(false);
    shouldPersistNextMoveRef.current = false;
  }, [tileSourceViewId]);

  useEffect(() => {
    setHasAutoFitTileBounds(false);
  }, [tileSourceFilter]);

  useEffect(() => {
    const handleMapContributionsUpdated = (event: Event) => {
      const updatedViewId = (event as CustomEvent<{ viewId?: string }>).detail
        ?.viewId;

      if (updatedViewId === tileSourceViewId) {
        refreshMapContributions();
      }
    };

    window.addEventListener(
      RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT,
      handleMapContributionsUpdated,
    );

    return () => {
      window.removeEventListener(
        RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT,
        handleMapContributionsUpdated,
      );
    };
  }, [refreshMapContributions, tileSourceViewId]);

  useEffect(() => {
    if (!isDefined(map) || !isDefined(tileSourceViewId)) {
      return;
    }

    const markUserMovedMap = () => {
      if (!isFittingTileBoundsRef.current) {
        setHasUserMovedTileMap(true);
        shouldPersistNextMoveRef.current = true;
      }
    };

    const persistUserMovedMap = () => {
      if (shouldPersistNextMoveRef.current) {
        shouldPersistNextMoveRef.current = false;
        persistCurrentMapCamera();
      }
    };

    map.on('dragstart', markUserMovedMap);
    map.on('moveend', persistUserMovedMap);
    map.on('pitchstart', markUserMovedMap);
    map.on('rotatestart', markUserMovedMap);
    map.on('zoomstart', markUserMovedMap);

    return () => {
      map.off('dragstart', markUserMovedMap);
      map.off('moveend', persistUserMovedMap);
      map.off('pitchstart', markUserMovedMap);
      map.off('rotatestart', markUserMovedMap);
      map.off('zoomstart', markUserMovedMap);
    };
  }, [map, persistCurrentMapCamera, tileSourceViewId]);

  useEffect(() => {
    return () => {
      persistRecordMapCamera.cancel();
    };
  }, [persistRecordMapCamera, tileSourceViewId]);

  const {
    closeFeaturePicker,
    featurePicker,
    openFeaturePickerAtPoint,
    openRecordFeature,
  } = useRecordMapVectorTileLayers({
    areAddressMarkersRendered: !isDefined(tileSource),
    map,
    objectNameSingular,
    onContributedFeatureClick: handleContributedFeatureClick,
    onFeatureClick: handleRecordClick,
    recordMapPoints,
    renderedContributionLayers,
    tileJson,
    tileSourceFilter,
    tileSourceViewId,
  });

  useRecordMapAddressMarkers({
    map,
    onMarkerClick: openFeaturePickerAtPoint,
    onRecordClick: handleRecordClick,
    recordMapPoints,
    tileSource,
  });

  useEffect(() => {
    if (
      !isDefined(tileBounds?.bounds) ||
      isDefined(persistedMapCamera) ||
      hasUserMovedTileMap ||
      hasAutoFitTileBounds
    ) {
      return;
    }

    fitMapToTileBounds();
    setHasAutoFitTileBounds(true);
  }, [
    fitMapToTileBounds,
    hasAutoFitTileBounds,
    hasUserMovedTileMap,
    persistedMapCamera,
    tileBounds,
  ]);

  if (!hasMapStyle) {
    return (
      <StyledContainer>
        <StyledEmptyState>Map style is not configured.</StyledEmptyState>
      </StyledContainer>
    );
  }

  if (!shouldRenderMap) {
    return (
      <StyledContainer>
        <StyledEmptyState>No records with coordinates to map.</StyledEmptyState>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledMapCanvas ref={setMapContainerElement} />
      {isDefined(tileSource) && (
        <RecordMapControls
          canFitToTileBounds={isDefined(tileBounds?.bounds)}
          map={map}
          onFitToTileBounds={() => fitMapToTileBounds({ persistCamera: true })}
          onSearchThisArea={onSearchThisArea}
        />
      )}
      <RecordMapRecordFeaturePicker
        containerElement={mapContainerElement}
        featurePicker={featurePicker}
        objectNameSingular={objectNameSingular}
        onClose={closeFeaturePicker}
        onSelectFeature={openRecordFeature}
      />
    </StyledContainer>
  );
};
