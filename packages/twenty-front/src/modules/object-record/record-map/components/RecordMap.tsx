import { REACT_APP_MAP_VIEW_STYLE_URL } from '~/config';

import { RecordMapControls } from '@/object-record/record-map/components/RecordMapControls';
import { RecordMapRecordFeaturePicker } from '@/object-record/record-map/components/RecordMapRecordFeaturePicker';
import { useOpenRecordFromIndexView } from '@/object-record/record-index/hooks/useOpenRecordFromIndexView';
import { useMapLibreMap } from '@/object-record/record-map/hooks/useMapLibreMap';
import { useMapTileMetadata } from '@/object-record/record-map/hooks/useMapTileMetadata';
import { useRecordMapAddressMarkers } from '@/object-record/record-map/hooks/useRecordMapAddressMarkers';
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
