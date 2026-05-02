import { Kind } from 'graphql';

import { GeometryScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars/geometry.scalar';
import { ValidationError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';

describe('GeometryScalarType', () => {
  it('should serialize supported GeoJSON geometries', () => {
    const point = {
      type: 'Point',
      coordinates: [1, 2],
    };
    const polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const multiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      ],
    };

    expect(GeometryScalarType.serialize(point)).toEqual(point);
    expect(GeometryScalarType.serialize(polygon)).toEqual(polygon);
    expect(GeometryScalarType.serialize(multiPolygon)).toEqual(multiPolygon);
  });

  it('should parse supported GeoJSON geometry literals', () => {
    expect(
      GeometryScalarType.parseLiteral(
        {
          kind: Kind.OBJECT,
          fields: [
            {
              kind: Kind.OBJECT_FIELD,
              name: { kind: Kind.NAME, value: 'type' },
              value: { kind: Kind.STRING, value: 'Polygon' },
            },
            {
              kind: Kind.OBJECT_FIELD,
              name: { kind: Kind.NAME, value: 'coordinates' },
              value: {
                kind: Kind.LIST,
                values: [
                  {
                    kind: Kind.LIST,
                    values: [
                      {
                        kind: Kind.LIST,
                        values: [
                          { kind: Kind.FLOAT, value: '0' },
                          { kind: Kind.FLOAT, value: '0' },
                        ],
                      },
                      {
                        kind: Kind.LIST,
                        values: [
                          { kind: Kind.FLOAT, value: '1' },
                          { kind: Kind.FLOAT, value: '0' },
                        ],
                      },
                      {
                        kind: Kind.LIST,
                        values: [
                          { kind: Kind.FLOAT, value: '1' },
                          { kind: Kind.FLOAT, value: '1' },
                        ],
                      },
                      {
                        kind: Kind.LIST,
                        values: [
                          { kind: Kind.FLOAT, value: '0' },
                          { kind: Kind.FLOAT, value: '0' },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {},
      ),
    ).toEqual({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    });
  });

  it('should reject invalid geometry values', () => {
    expect(() =>
      GeometryScalarType.parseValue({
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      }),
    ).toThrow(ValidationError);
  });
});
