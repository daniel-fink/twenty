import { FieldMetadataType } from 'twenty-shared/types';

import { computeWhereConditionParts } from 'src/engine/api/graphql/graphql-query-runner/utils/compute-where-condition-parts';

const point = {
  type: 'Point',
  coordinates: [151.2093, -33.8688],
} as const;

describe('computeWhereConditionParts geometry filters', () => {
  it('should generate parameterized distance SQL with geography meters check', () => {
    const result = computeWhereConditionParts({
      operator: 'withinDistance',
      objectNameSingular: 'company',
      key: 'location',
      value: {
        point,
        distanceInMeters: 500,
      },
      fieldMetadataType: FieldMetadataType.GEOMETRY,
    });

    expect(result.sql).toContain('ST_DWithin("company"."location"');
    expect(result.sql).toContain('ST_GeomFromGeoJSON(:');
    expect(result.sql).toContain('"company"."location"::geography');
    expect(result.sql).not.toContain(JSON.stringify(point));
    expect(Object.values(result.params)).toContain(JSON.stringify(point));
    expect(Object.values(result.params)).toContain(500);
    expect(Object.values(result.params)).toContain(500 / 111_320);
  });

  it('should generate parameterized bbox SQL with an index-aware prefilter', () => {
    const result = computeWhereConditionParts({
      operator: 'withinBbox',
      objectNameSingular: 'company',
      key: 'location',
      value: {
        west: 151.19,
        south: -33.88,
        east: 151.22,
        north: -33.84,
      },
      fieldMetadataType: FieldMetadataType.GEOMETRY,
    });

    expect(result.sql).toContain('"company"."location" && ST_MakeEnvelope');
    expect(result.sql).toContain('ST_Within("company"."location"');
    expect(Object.values(result.params)).toEqual([
      151.19, -33.88, 151.22, -33.84,
    ]);
  });

  it.each(['intersects', 'contains', 'within'] as const)(
    'should generate parameterized %s SQL',
    (operator) => {
      const result = computeWhereConditionParts({
        operator,
        objectNameSingular: 'company',
        key: 'location',
        value: point,
        fieldMetadataType: FieldMetadataType.GEOMETRY,
      });

      expect(result.sql).toContain('ST_SetSRID(ST_GeomFromGeoJSON(:');
      expect(result.sql).not.toContain(JSON.stringify(point));
      expect(Object.values(result.params)).toEqual([JSON.stringify(point)]);
    },
  );
});
