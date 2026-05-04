import { render, screen } from '@testing-library/react';

import { RecordMap } from '@/object-record/record-map/components/RecordMap';
import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { type RecordMapReferenceLayer } from '@/object-record/record-map/types/RecordMapReferenceLayer';

const useMapLibreMapMock = jest.fn();
const useMapReferenceLayersMock = jest.fn();

jest.mock('~/config', () => ({
  REACT_APP_MAP_VIEW_STYLE_URL: 'https://example.com/style.json',
}));

jest.mock('@/object-record/record-map/hooks/useMapLibreMap', () => ({
  useMapLibreMap: (args: unknown) => useMapLibreMapMock(args),
}));

jest.mock('@/object-record/record-map/hooks/useMapReferenceLayers', () => ({
  useMapReferenceLayers: (args: unknown) => useMapReferenceLayersMock(args),
}));

jest.mock(
  '@/object-record/record-map/hooks/useMapReferenceLayerBounds',
  () => ({
    useMapReferenceLayerBounds: () => ({ referenceLayerBounds: null }),
  }),
);

jest.mock('@/object-record/record-map/hooks/useMapTileMetadata', () => ({
  useMapTileMetadata: () => ({ tileBounds: null, tileJson: null }),
}));

jest.mock(
  '@/object-record/record-map/hooks/useRecordMapAddressMarkers',
  () => ({
    useRecordMapAddressMarkers: jest.fn(),
  }),
);

jest.mock(
  '@/object-record/record-map/hooks/useRecordMapReferenceLayers',
  () => ({
    useRecordMapReferenceLayers: () => ({
      closeFeaturePicker: jest.fn(),
      featurePicker: null,
      openReferenceFeature: jest.fn(),
    }),
  }),
);

jest.mock(
  '@/object-record/record-map/hooks/useRecordMapVectorTileLayers',
  () => ({
    useRecordMapVectorTileLayers: () => ({
      closeFeaturePicker: jest.fn(),
      featurePicker: null,
      openRecordFeature: jest.fn(),
    }),
  }),
);

jest.mock(
  '@/object-record/record-index/hooks/useOpenRecordFromIndexView',
  () => ({
    useOpenRecordFromIndexView: () => ({
      openRecordFromIndexView: jest.fn(),
    }),
  }),
);

const referenceLayer = {
  attachment: {
    defaultIsVisible: true,
    isVisible: true,
    position: 0,
  },
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

describe('RecordMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMapLibreMapMock.mockReturnValue({ map: null });
  });

  it('renders a reference-only map view when reference layers are attached', () => {
    useMapReferenceLayersMock.mockReturnValue({
      isLoadingReferenceLayers: false,
      referenceLayers: [referenceLayer],
      referenceLayersError: null,
    });

    render(
      <RecordMap loading={false} recordMapPoints={[]} viewId="map-view-id" />,
    );

    expect(
      screen.queryByText('No records with coordinates to map.'),
    ).toBeNull();
    expect(useMapReferenceLayersMock).toHaveBeenCalledWith({
      viewId: 'map-view-id',
    });
    expect(useMapLibreMapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldRenderMap: true,
      }),
    );
  });

  it('surfaces reference layer load errors on the map surface', () => {
    useMapReferenceLayersMock.mockReturnValue({
      isLoadingReferenceLayers: false,
      referenceLayers: [],
      referenceLayersError: new Error('Failed to load reference layers'),
    });

    render(
      <RecordMap loading={false} recordMapPoints={[]} viewId="map-view-id" />,
    );

    expect(
      screen.getByText('Reference layers could not be loaded.'),
    ).toBeInTheDocument();
    expect(useMapLibreMapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldRenderMap: true,
      }),
    );
  });
});
