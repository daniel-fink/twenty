import { REACT_APP_MAP_VIEW_STYLE_URL } from '~/config';

import { RECORD_MAP_REFERENCE_LAYERS_UPDATED_EVENT } from '@/object-record/record-map/constants/record-map-reference-layer.constants';
import { RecordMapControls } from '@/object-record/record-map/components/RecordMapControls';
import { RecordMapRecordFeaturePicker } from '@/object-record/record-map/components/RecordMapRecordFeaturePicker';
import { useOpenRecordFromIndexView } from '@/object-record/record-index/hooks/useOpenRecordFromIndexView';
import { useMapLibreMap } from '@/object-record/record-map/hooks/useMapLibreMap';
import { useMapTileMetadata } from '@/object-record/record-map/hooks/useMapTileMetadata';
import { useRecordMapAddressMarkers } from '@/object-record/record-map/hooks/useRecordMapAddressMarkers';
import { useRecordMapReferenceLayerContributions } from '@/object-record/record-map/hooks/useRecordMapReferenceLayerContributions';
import { useRecordMapReferenceLayers } from '@/object-record/record-map/hooks/useRecordMapReferenceLayers';
import { useRecordMapVectorTileLayers } from '@/object-record/record-map/hooks/useRecordMapVectorTileLayers';
import { type RecordMapReferenceFeaturePickerItem } from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { type RecordMapTileSource } from '@/object-record/record-map/types/RecordMapTileSource';
import {
  getPaddedRecordMapBounds,
  type RecordMapBounds,
} from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { styled } from '@linaria/react';
import { useApolloClient } from '@apollo/client/react';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useOpenFrontComponentInSidePanel } from '@/side-panel/hooks/useOpenFrontComponentInSidePanel';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { IconMap } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { FindOneApplicationByUniversalIdentifierDocument } from '~/generated-metadata/graphql';

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
  const [isFittingTileBounds, setIsFittingTileBounds] = useState(false);
  const { openRecordFromIndexView } = useOpenRecordFromIndexView();
  const apolloClient = useApolloClient();
  const { enqueueErrorSnackBar } = useSnackBar();
  const { openFrontComponentInSidePanel } = useOpenFrontComponentInSidePanel();

  const hasMapStyle = REACT_APP_MAP_VIEW_STYLE_URL !== '';
  const shouldRenderMap =
    hasMapStyle &&
    (isDefined(tileSource) || loading || recordMapPoints.length > 0);
  const tileSourceViewId = tileSource?.viewId;
  const tileSourceFilter = JSON.stringify(tileSource?.filter ?? {});
  const { map } = useMapLibreMap({
    mapContainerElement,
    shouldRenderMap,
  });
  const { tileBounds, tileJson } = useMapTileMetadata({
    tileSourceFilter,
    tileSourceViewId,
  });
  const { referenceLayerContributions, refreshReferenceLayerContributions } =
    useRecordMapReferenceLayerContributions({
      tileSourceViewId,
    });
  const { renderedReferenceLayers } = useRecordMapReferenceLayers({
    map,
    referenceLayerContributions,
  });

  const handleRecordClick = useCallback(
    (recordId: string) => {
      openRecordFromIndexView({ recordId });
    },
    [openRecordFromIndexView],
  );

  const handleReferenceFeatureClick = useCallback(
    async (item: RecordMapReferenceFeaturePickerItem) => {
      const { data } = await apolloClient.query({
        query: FindOneApplicationByUniversalIdentifierDocument,
        variables: {
          universalIdentifier:
            item.contribution.featureDetailApplicationUniversalIdentifier,
        },
      });
      const frontComponent = data?.findOneApplication?.frontComponents.find(
        (candidate) =>
          candidate.universalIdentifier ===
          item.contribution.featureDetailFrontComponentUniversalIdentifier,
      );

      if (!isDefined(frontComponent)) {
        enqueueErrorSnackBar({
          message: 'Unable to open reference layer feature detail.',
        });

        return;
      }

      openFrontComponentInSidePanel({
        frontComponentId: frontComponent.id,
        pageIcon: IconMap,
        pageTitle: item.title,
        params: {
          featureId: item.featureId,
          layerId: item.layerId,
          viewId: item.viewId,
        },
      });
    },
    [apolloClient, enqueueErrorSnackBar, openFrontComponentInSidePanel],
  );

  const fitMapToTileBounds = useCallback(() => {
    if (!isDefined(map) || !isDefined(tileBounds?.bounds)) {
      return;
    }

    setIsFittingTileBounds(true);

    map.once('moveend', () => {
      setIsFittingTileBounds(false);
    });
    window.setTimeout(() => {
      setIsFittingTileBounds(false);
    }, 750);

    map.fitBounds(getPaddedRecordMapBounds(tileBounds.bounds), {
      padding: 64,
      maxZoom: 12,
      essential: true,
    });
  }, [map, tileBounds]);

  useEffect(() => {
    setHasAutoFitTileBounds(false);
    setHasUserMovedTileMap(false);
  }, [tileSourceViewId]);

  useEffect(() => {
    setHasAutoFitTileBounds(false);
  }, [tileSourceFilter]);

  useEffect(() => {
    const handleReferenceLayersUpdated = (event: Event) => {
      const updatedViewId = (event as CustomEvent<{ viewId?: string }>).detail
        ?.viewId;

      if (updatedViewId === tileSourceViewId) {
        refreshReferenceLayerContributions();
      }
    };

    window.addEventListener(
      RECORD_MAP_REFERENCE_LAYERS_UPDATED_EVENT,
      handleReferenceLayersUpdated,
    );

    return () => {
      window.removeEventListener(
        RECORD_MAP_REFERENCE_LAYERS_UPDATED_EVENT,
        handleReferenceLayersUpdated,
      );
    };
  }, [refreshReferenceLayerContributions, tileSourceViewId]);

  useEffect(() => {
    if (!isDefined(map) || !isDefined(tileSourceViewId)) {
      return;
    }

    const markUserMovedMap = () => {
      if (!isFittingTileBounds) {
        setHasUserMovedTileMap(true);
      }
    };

    map.on('dragstart', markUserMovedMap);
    map.on('zoomstart', markUserMovedMap);

    return () => {
      map.off('dragstart', markUserMovedMap);
      map.off('zoomstart', markUserMovedMap);
    };
  }, [isFittingTileBounds, map, tileSourceViewId]);

  useRecordMapAddressMarkers({
    map,
    onRecordClick: handleRecordClick,
    recordMapPoints,
    tileSource,
  });

  const { closeFeaturePicker, featurePicker, openRecordFeature } =
    useRecordMapVectorTileLayers({
      map,
      objectNameSingular,
      onFeatureClick: handleRecordClick,
      onReferenceFeatureClick: handleReferenceFeatureClick,
      renderedReferenceLayers,
      tileJson,
      tileSourceFilter,
      tileSourceViewId,
    });

  useEffect(() => {
    if (
      !isDefined(tileBounds?.bounds) ||
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
          onFitToTileBounds={fitMapToTileBounds}
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
