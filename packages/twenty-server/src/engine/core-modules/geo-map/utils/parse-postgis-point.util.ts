import { isGeoJsonPoint, type GeoJsonPoint } from 'twenty-shared/types';

const EWKB_SRID_FLAG = 0x20000000;
const WKB_POINT_TYPE = 1;

export const parsePostgisPoint = (value: unknown): GeoJsonPoint | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (isGeoJsonPoint(value)) {
    return value;
  }

  const buffer =
    typeof value === 'string'
      ? Buffer.from(value, 'hex')
      : Buffer.isBuffer(value)
        ? value
        : null;

  if (!buffer || buffer.length < 21) {
    return null;
  }

  const littleEndian = buffer.readUInt8(0) === 1;
  const readUInt32 = littleEndian
    ? buffer.readUInt32LE.bind(buffer)
    : buffer.readUInt32BE.bind(buffer);
  const readDouble = littleEndian
    ? buffer.readDoubleLE.bind(buffer)
    : buffer.readDoubleBE.bind(buffer);

  const typeWithFlags = readUInt32(1);
  const geometryType = typeWithFlags & ~EWKB_SRID_FLAG;

  if (geometryType !== WKB_POINT_TYPE) {
    return null;
  }

  const coordinatesOffset = typeWithFlags & EWKB_SRID_FLAG ? 9 : 5;

  if (buffer.length < coordinatesOffset + 16) {
    return null;
  }

  const point = {
    type: 'Point',
    coordinates: [
      readDouble(coordinatesOffset),
      readDouble(coordinatesOffset + 8),
    ],
  } as const;

  return isGeoJsonPoint(point) ? point : null;
};
