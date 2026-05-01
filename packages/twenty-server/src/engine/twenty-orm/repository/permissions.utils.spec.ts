import { extractSelectedColumnNameFromSelectExpression } from 'src/engine/twenty-orm/repository/permissions.utils';

describe('permissions utils', () => {
  describe('extractSelectedColumnNameFromSelectExpression', () => {
    it('should resolve raw PostGIS geometry casts to the underlying field column', () => {
      expect(
        extractSelectedColumnNameFromSelectExpression(
          '"geoBenchmarkPoint"."geometry"::geometry',
        ),
      ).toBe('geometry');
    });

    it('should resolve quoted columns wrapped in SQL functions', () => {
      expect(
        extractSelectedColumnNameFromSelectExpression(
          'ST_AsGeoJSON("geoBenchmarkPolygon"."geometry")',
        ),
      ).toBe('geometry');
    });

    it('should preserve existing dotted column behavior', () => {
      expect(
        extractSelectedColumnNameFromSelectExpression('geoBenchmarkPoint.id'),
      ).toBe('id');
    });
  });
});
