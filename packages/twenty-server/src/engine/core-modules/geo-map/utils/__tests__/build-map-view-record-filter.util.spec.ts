import {
  FieldMetadataType,
  ViewFilterOperand,
  ViewType,
} from 'twenty-shared/types';

import { buildMapViewRecordFilter } from 'src/engine/core-modules/geo-map/utils/build-map-view-record-filter.util';

const createFlatEntityMaps = <T extends { id: string }>(entities: T[]) => ({
  byUniversalIdentifier: Object.fromEntries(
    entities.map((entity) => [entity.id, entity]),
  ),
  universalIdentifierById: Object.fromEntries(
    entities.map((entity) => [entity.id, entity.id]),
  ),
  universalIdentifiersByApplicationId: {},
});

describe('buildMapViewRecordFilter', () => {
  it('should AND request filters, saved filters, and any-field filters', () => {
    const filter = buildMapViewRecordFilter({
      flatView: {
        anyFieldFilterValue: 'global',
        deletedAt: null,
        id: 'view-id',
        mapFieldMetadataId: 'geometry-field-id',
        objectMetadataId: 'object-id',
        type: ViewType.MAP,
      } as never,
      flatObjectMetadata: {
        fieldIds: ['geometry-field-id', 'name-field-id'],
        id: 'object-id',
        nameSingular: 'geoBenchmarkRealPolygon',
      } as never,
      flatFieldMetadataMaps: createFlatEntityMaps([
        {
          id: 'geometry-field-id',
          label: 'Geometry',
          name: 'geometry',
          type: FieldMetadataType.GEOMETRY,
        },
        {
          id: 'name-field-id',
          label: 'Name',
          name: 'name',
          type: FieldMetadataType.TEXT,
        },
      ]) as never,
      flatViewFilterMaps: createFlatEntityMaps([
        {
          deletedAt: null,
          fieldMetadataId: 'name-field-id',
          id: 'view-filter-id',
          operand: ViewFilterOperand.CONTAINS,
          positionInViewFilterGroup: null,
          subFieldName: null,
          value: 'borough',
          viewFilterGroupId: null,
          viewId: 'view-id',
        },
        {
          deletedAt: null,
          fieldMetadataId: 'geometry-field-id',
          id: 'geometry-filter-id',
          operand: ViewFilterOperand.WITHIN_BBOX,
          positionInViewFilterGroup: null,
          subFieldName: null,
          value: { west: 1, south: 2, east: 3, north: 4 },
          viewFilterGroupId: null,
          viewId: 'view-id',
        },
      ]) as never,
      flatViewFilterGroupMaps: createFlatEntityMaps([]) as never,
      requestRecordFilter: {
        id: {
          in: ['record-id'],
        },
      },
    });

    expect(filter).toEqual({
      and: [
        {
          id: {
            in: ['record-id'],
          },
        },
        {
          and: [
            {
              name: {
                ilike: '%borough%',
              },
            },
            {
              geometry: {
                withinBbox: {
                  east: 3,
                  north: 4,
                  south: 2,
                  west: 1,
                },
              },
            },
          ],
        },
        {
          or: [
            {
              name: {
                ilike: '%global%',
              },
            },
          ],
        },
      ],
    });
  });
});
