import { REACT_APP_MAP_VIEW_STYLE_URL } from '~/config';

import { RecordMapControls } from '@/object-record/record-map/components/RecordMapControls';
import { RecordMapRecordFeaturePicker } from '@/object-record/record-map/components/RecordMapRecordFeaturePicker';
import { RecordMapReferenceFeaturePicker } from '@/object-record/record-map/components/RecordMapReferenceFeaturePicker';
import { useOpenRecordFromIndexView } from '@/object-record/record-index/hooks/useOpenRecordFromIndexView';
import { useMapLibreMap } from '@/object-record/record-map/hooks/useMapLibreMap';
import { useMapReferenceLayerBounds } from '@/object-record/record-map/hooks/useMapReferenceLayerBounds';
import { useMapReferenceLayers } from '@/object-record/record-map/hooks/useMapReferenceLayers';
import { useMapTileMetadata } from '@/object-record/record-map/hooks/useMapTileMetadata';
import { useRecordMapAddressMarkers } from '@/object-record/record-map/hooks/useRecordMapAddressMarkers';
import { useRecordMapReferenceLayers } from '@/object-record/record-map/hooks/useRecordMapReferenceLayers';
import { useRecordMapVectorTileLayers } from '@/object-record/record-map/hooks/useRecordMapVectorTileLayers';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { type RecordMapTileSource } from '@/object-record/record-map/types/RecordMapTileSource';
import {
  getPaddedRecordMapBounds,
  type RecordMapBounds,
} from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
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

const StyledMapStatusOverlay = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  left: ${themeCssVariables.spacing[2]};
  max-width: min(320px, calc(100% - ${themeCssVariables.spacing[4]}));
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  position: absolute;
  top: ${themeCssVariables.spacing[2]};
  z-index: 1;
`;

export const RecordMap = ({
  loading,
  objectNameSingular,
  recordMapPoints,
  tileSource,
  viewId,
  onSearchThisArea,
}: {
  loading: boolean;
  objectNameSingular?: string;
  recordMapPoints: RecordMapPoint[];
  tileSource?: RecordMapTileSource;
  viewId?: string;
  onSearchThisArea?: (bounds: RecordMapBounds) => void;
}) => {
  const [mapContainerElement, setMapContainerElement] =
    useState<HTMLDivElement | null>(null);
  const [hasAutoFitTileBounds, setHasAutoFitTileBounds] = useState(false);
  const [hasAutoFitReferenceLayerBounds, setHasAutoFitReferenceLayerBounds] =
    useState(false);
  const [hasUserMovedTileMap, setHasUserMovedTileMap] = useState(false);
  const { openRecordFromIndexView } = useOpenRecordFromIndexView();

  const hasMapStyle = REACT_APP_MAP_VIEW_STYLE_URL !== '';
  const tileSourceViewId = tileSource?.viewId;
  const mapViewId = tileSourceViewId ?? viewId;
  const tileSourceFilter = JSON.stringify(tileSource?.filter ?? {});
  const { tileBounds, tileJson } = useMapTileMetadata({
    tileSourceFilter,
    tileSourceViewId,
  });
  const { isLoadingReferenceLayers, referenceLayers, referenceLayersError } =
    useMapReferenceLayers({
      viewId: mapViewId,
    });
  const shouldRenderMap =
    hasMapStyle &&
    (isDefined(tileSource) ||
      loading ||
      recordMapPoints.length > 0 ||
      isLoadingReferenceLayers ||
      referenceLayers.length > 0 ||
      isDefined(referenceLayersError));
  const { map } = useMapLibreMap({
    mapContainerElement,
    shouldRenderMap,
  });
  const { referenceLayerBounds } = useMapReferenceLayerBounds({
    referenceLayers,
    viewId: mapViewId,
  });

  const handleRecordClick = useCallback(
    (recordId: string) => {
      openRecordFromIndexView({ recordId });
    },
    [openRecordFromIndexView],
  );

  const fitMapToTileBounds = useCallback(() => {
    if (!isDefined(map) || !isDefined(tileBounds?.bounds)) {
      return;
    }

    map.fitBounds(getPaddedRecordMapBounds(tileBounds.bounds), {
      padding: 64,
      maxZoom: 12,
      essential: true,
    });
  }, [map, tileBounds]);

  const fitMapToReferenceLayerBounds = useCallback(() => {
    if (!isDefined(map) || !isDefined(referenceLayerBounds?.bounds)) {
      return;
    }

    map.fitBounds(getPaddedRecordMapBounds(referenceLayerBounds.bounds), {
      padding: 64,
      maxZoom: 15,
      essential: true,
    });
  }, [map, referenceLayerBounds]);

  useEffect(() => {
    setHasAutoFitTileBounds(false);
    setHasAutoFitReferenceLayerBounds(false);
    setHasUserMovedTileMap(false);
  }, [mapViewId]);

  useEffect(() => {
    setHasAutoFitTileBounds(false);
  }, [tileSourceFilter]);

  useEffect(() => {
    if (!isDefined(map) || !isDefined(mapViewId)) {
      return;
    }

    const markUserMovedMap = () => {
      setHasUserMovedTileMap(true);
    };

    map.on('dragstart', markUserMovedMap);

    return () => {
      map.off('dragstart', markUserMovedMap);
    };
  }, [map, mapViewId]);

  useRecordMapAddressMarkers({
    map,
    onRecordClick: handleRecordClick,
    recordMapPoints,
    tileSource,
  });

  const { closeFeaturePicker, featurePicker, openReferenceFeature } =
    useRecordMapReferenceLayers({
      map,
      referenceLayers,
      viewId: mapViewId,
    });

  const {
    closeFeaturePicker: closeRecordFeaturePicker,
    featurePicker: recordFeaturePicker,
    openRecordFeature,
  } = useRecordMapVectorTileLayers({
    map,
    objectNameSingular,
    onFeatureClick: handleRecordClick,
    tileJson,
    tileSourceFilter,
    tileSourceViewId,
  });

  useEffect(() => {
    if (
      !isDefined(tileBounds?.bounds) ||
      isDefined(referenceLayerBounds?.bounds) ||
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
    referenceLayerBounds,
    tileBounds,
  ]);

  useEffect(() => {
    if (
      !isDefined(referenceLayerBounds?.bounds) ||
      hasUserMovedTileMap ||
      hasAutoFitReferenceLayerBounds
    ) {
      return;
    }

    fitMapToReferenceLayerBounds();
    setHasAutoFitReferenceLayerBounds(true);
  }, [
    fitMapToReferenceLayerBounds,
    hasAutoFitReferenceLayerBounds,
    hasUserMovedTileMap,
    referenceLayerBounds,
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
      {isLoadingReferenceLayers && (
        <StyledMapStatusOverlay>
          Loading reference layers...
        </StyledMapStatusOverlay>
      )}
      {isDefined(referenceLayersError) && (
        <StyledMapStatusOverlay>
          Reference layers could not be loaded.
        </StyledMapStatusOverlay>
      )}
      <RecordMapReferenceFeaturePicker
        containerElement={mapContainerElement}
        featurePicker={featurePicker}
        onClose={closeFeaturePicker}
        onSelectFeature={openReferenceFeature}
      />
      <RecordMapRecordFeaturePicker
        containerElement={mapContainerElement}
        featurePicker={recordFeaturePicker}
        objectNameSingular={objectNameSingular}
        onClose={closeRecordFeaturePicker}
        onSelectFeature={openRecordFeature}
      />
    </StyledContainer>
  );
};
