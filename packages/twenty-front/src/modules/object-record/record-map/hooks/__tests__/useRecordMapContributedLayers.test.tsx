import { useRecordMapContributedLayers } from '@/object-record/record-map/hooks/useRecordMapContributedLayers';
import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';
import { getRecordMapContributedLayerPrefix } from '@/object-record/record-map/utils/getRecordMapContributedLayerPrefix';
import { renderHook, waitFor } from '@testing-library/react';

import type maplibregl from 'maplibre-gl';

const fillContribution = {
  contributionId: 'view-1:parcel',
  displayName: 'Parcels',
  isVisible: true,
  layerId: 'parcel',
  position: 10,
  sourceLayerName: 'parcels',
  style: {
    fillColor: '#2563eb',
    fillOpacity: 0,
    lineColor: '#404040',
    lineWidth: 0.1,
    type: 'fill',
  },
  tileJsonUrl: 'https://example.test/tile-json',
  viewId: 'view-1',
} satisfies RecordMapLayerContribution;

const createMapMock = () => {
  const map = {} as maplibregl.Map;

  Object.assign(map, {
    addLayer: jest.fn(),
    addSource: jest.fn(),
    getCanvas: jest.fn(() => ({ style: {} })),
    getLayer: jest.fn(() => undefined),
    getSource: jest.fn(() => undefined),
    isStyleLoaded: jest.fn(() => true),
    off: jest.fn(() => map),
    on: jest.fn(() => map),
    once: jest.fn(() => map),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
  });

  return map;
};

describe('useRecordMapContributedLayers', () => {
  it('adds a generic queryable hit layer for transparent fill contributions', async () => {
    const map = createMapMock();
    const layerContributions = [fillContribution];
    const layerPrefix = getRecordMapContributedLayerPrefix(
      fillContribution.contributionId,
    );

    const { result } = renderHook(() =>
      useRecordMapContributedLayers({
        layerContributions,
        map,
        selectedContributionFeature: null,
      }),
    );

    await waitFor(() =>
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `${layerPrefix}-hit`,
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.01,
          },
          type: 'fill',
        }),
        undefined,
      ),
    );

    expect(result.current.renderedContributionLayers).toMatchObject([
      {
        hitLayerIds: [`${layerPrefix}-hit`],
        layerIds: [`${layerPrefix}-fill`, `${layerPrefix}-outline`],
      },
    ]);
    expect(map.on).toHaveBeenCalledWith(
      'mouseenter',
      `${layerPrefix}-hit`,
      expect.any(Function),
    );
  });

  it('uses feature properties for data-driven fill opacity', async () => {
    const map = createMapMock();
    const layerContributions = [
      {
        ...fillContribution,
        style: {
          ...fillContribution.style,
          fillOpacity: 0.5,
          fillOpacityProperty: 'display_fill_opacity',
        },
      },
    ];
    const layerPrefix = getRecordMapContributedLayerPrefix(
      fillContribution.contributionId,
    );

    renderHook(() =>
      useRecordMapContributedLayers({
        layerContributions,
        map,
        selectedContributionFeature: null,
      }),
    );

    await waitFor(() =>
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `${layerPrefix}-fill`,
          paint: expect.objectContaining({
            'fill-opacity': ['to-number', ['get', 'display_fill_opacity'], 0.5],
          }),
        }),
        undefined,
      ),
    );
  });
});
