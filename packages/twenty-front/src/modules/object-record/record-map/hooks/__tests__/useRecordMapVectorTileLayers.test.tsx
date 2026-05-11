import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import { useRecordMapVectorTileLayers } from '@/object-record/record-map/hooks/useRecordMapVectorTileLayers';
import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';
import { act, renderHook, waitFor } from '@testing-library/react';

import type maplibregl from 'maplibre-gl';

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: '',
}));

jest.mock('@/apollo/utils/ensureTokenPairIsFresh', () => ({
  ensureTokenPairIsFresh: jest.fn(async () => undefined),
}));

const baseContribution = {
  featureSelectionAction: {
    applicationUniversalIdentifier: 'app-id',
    frontComponentUniversalIdentifier: 'front-component-id',
    type: 'OPEN_FRONT_COMPONENT' as const,
  },
  featureIdProperty: 'selectedFeatureValue',
  isVisible: true,
  position: 10,
  sourceLayerName: 'source-layer',
  titleProperty: 'title',
  tileJsonUrl: 'https://example.test/tile-json',
  viewId: 'view-1',
} satisfies Partial<RecordMapLayerContribution>;

const createContribution = ({
  contributionId,
  displayName,
  layerId,
}: {
  contributionId: string;
  displayName: string;
  layerId: string;
}): RecordMapLayerContribution => ({
  ...baseContribution,
  contributionId,
  displayName,
  layerId,
  style: {
    fillColor: '#2563eb',
    fillOpacity: 0,
    type: 'fill',
  },
});

type MapClickHandler = (event: { point: { x: number; y: number } }) => void;

const createMapMock = () => {
  const clickHandlers: MapClickHandler[] = [];
  const map = {} as maplibregl.Map;
  const on = jest.fn((eventName: string, ...args: unknown[]) => {
    if (eventName === 'click' && args.length === 1) {
      clickHandlers.push(args[0] as MapClickHandler);
    }

    return map;
  });
  const off = jest.fn(() => map);

  Object.assign(map, {
    addLayer: jest.fn(),
    getCanvas: jest.fn(() => ({ style: {} })),
    getLayer: jest.fn(() => ({})),
    getSource: jest.fn(() => ({})),
    isStyleLoaded: jest.fn(() => true),
    off,
    on,
    once: jest.fn(() => map),
    project: jest.fn(() => ({ x: 12, y: 12 })),
    queryRenderedFeatures: jest.fn(
      (
        _box: unknown,
        options?: {
          layers?: string[];
        },
      ) => {
        const layers = options?.layers ?? [];

        if (layers.includes(RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId)) {
          return [
            {
              layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId },
              properties: {
                id: 'record-1',
                title: 'Native record',
              },
            },
          ];
        }

        return [
          ...(layers.includes('parcel-hit')
            ? [
                {
                  layer: { id: 'parcel-hit' },
                  properties: {
                    selectedFeatureValue: 'parcel-1',
                    title: 'Parcel 1',
                  },
                },
              ]
            : []),
          ...(layers.includes('forecast-hit')
            ? [
                {
                  layer: { id: 'forecast-hit' },
                  properties: {
                    selectedFeatureValue: 'forecast-1',
                    title: 'Forecast 1',
                  },
                },
              ]
            : []),
          ...(layers.includes('transactions-hit')
            ? [
                {
                  layer: { id: 'transactions-hit' },
                  properties: {
                    selectedFeatureValue: 'transaction-1',
                    title: 'Transaction 1',
                  },
                },
                {
                  layer: { id: 'transactions-hit' },
                  properties: {
                    selectedFeatureValue: 'transaction-2',
                    title: 'Transaction 2',
                  },
                },
              ]
            : []),
        ];
      },
    ),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
  });

  return { clickHandlers, map, on };
};

describe('useRecordMapVectorTileLayers', () => {
  it('opens one combined picker for native records, address markers, and contributed features', async () => {
    const { clickHandlers, map, on } = createMapMock();
    const onFeatureClick = jest.fn();
    const onContributedFeatureClick = jest.fn();
    const parcel = createContribution({
      contributionId: 'view-1:parcel',
      displayName: 'Parcels',
      layerId: 'parcel',
    });
    const forecast = createContribution({
      contributionId: 'view-1:forecast',
      displayName: 'Forecast Apartments',
      layerId: 'forecast',
    });
    const transactions = createContribution({
      contributionId: 'view-1:transactions',
      displayName: 'Transactions',
      layerId: 'transactions',
    });

    const { result } = renderHook(() =>
      useRecordMapVectorTileLayers({
        areAddressMarkersRendered: true,
        map,
        objectNameSingular: 'company',
        onContributedFeatureClick,
        onFeatureClick,
        recordMapPoints: [
          {
            latitude: -33.9,
            longitude: 151.2,
            record: {
              __typename: 'Company',
              displayName: 'Address marker',
              id: 'marker-record',
              name: 'Address marker',
            },
          },
        ],
        renderedContributionLayers: [
          {
            contribution: parcel,
            hitLayerIds: ['parcel-hit'],
            layerIds: ['parcel-fill'],
          },
          {
            contribution: forecast,
            hitLayerIds: ['forecast-hit'],
            layerIds: ['forecast-fill'],
          },
          {
            contribution: transactions,
            hitLayerIds: ['transactions-hit'],
            layerIds: ['transactions-circle'],
          },
        ],
        tileJson: null,
        tileSourceFilter: '{}',
        tileSourceViewId: undefined,
      }),
    );

    await waitFor(() => expect(clickHandlers).toHaveLength(1));

    act(() => {
      clickHandlers[0]?.({ point: { x: 10, y: 10 } });
    });

    expect(
      result.current.featurePicker?.items.map((item) => item.title),
    ).toEqual([
      'Native record',
      'Address marker',
      'Parcel 1',
      'Forecast 1',
      'Transaction 1',
      'Transaction 2',
    ]);
    expect(onFeatureClick).not.toHaveBeenCalled();
    expect(onContributedFeatureClick).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalledWith(
      'click',
      expect.any(String),
      expect.any(Function),
    );
  });
});
