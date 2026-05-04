import { renderHook, waitFor } from '@testing-library/react';

import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { useRecordMapReferenceLayers } from '@/object-record/record-map/hooks/useRecordMapReferenceLayers';
import { type RecordMapReferenceLayer } from '@/object-record/record-map/types/RecordMapReferenceLayer';

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'https://example.com',
}));

jest.mock('@/apollo/utils/ensureTokenPairIsFresh', () => ({
  ensureTokenPairIsFresh: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/side-panel/hooks/useNavigateSidePanel', () => ({
  useNavigateSidePanel: () => ({
    navigateSidePanel: jest.fn(),
  }),
}));

const referenceLayer = {
  attachment: {
    defaultIsVisible: true,
    isVisible: true,
    position: 0,
  },
  attribution: 'Demo attribution',
  id: 'reference-layer-id',
  key: 'parcels',
  name: 'Parcels',
  query: {
    selectedFeatureField: 'parcel_id',
    sort: [],
  },
  source: {
    geometryType: 'MULTIPOLYGON',
  },
  style: {
    fillColor: RECORD_MAP_LAYER_COLORS.blue,
    fillOpacity: 0.2,
    type: 'fill',
  },
  tile: {
    maxZoom: 16,
    minZoom: 10,
  },
} satisfies RecordMapReferenceLayer;

describe('useRecordMapReferenceLayers', () => {
  it('passes source attribution to MapLibre vector sources', async () => {
    const map = {
      addLayer: jest.fn(),
      addSource: jest.fn(),
      getCanvas: jest.fn(() => ({ style: {} })),
      getLayer: jest.fn(() => undefined),
      getSource: jest.fn(() => undefined),
      isStyleLoaded: jest.fn(() => true),
      off: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      queryRenderedFeatures: jest.fn(() => []),
      removeLayer: jest.fn(),
      removeSource: jest.fn(),
    };

    renderHook(() =>
      useRecordMapReferenceLayers({
        map: map as never,
        referenceLayers: [referenceLayer],
        viewId: 'map-view-id',
      }),
    );

    await waitFor(() => {
      expect(map.addSource).toHaveBeenCalledWith(
        'record-map-reference-source-reference-layer-id',
        expect.objectContaining({
          attribution: 'Demo attribution',
        }),
      );
    });
  });
});
