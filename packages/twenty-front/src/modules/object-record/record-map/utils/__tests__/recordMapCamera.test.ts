import {
  DEFAULT_RECORD_MAP_CAMERA,
  getInitialRecordMapCamera,
  isValidRecordMapCamera,
  readRecordMapCamera,
  writeRecordMapCamera,
} from '@/object-record/record-map/utils/recordMapCamera';

describe('recordMapCamera', () => {
  const camera = {
    bearing: 2,
    latitude: -33.86,
    longitude: 151.2,
    pitch: 10,
    updatedAt: '2026-05-06T00:00:00.000Z',
    zoom: 13.5,
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should accept a complete finite map camera', () => {
    expect(isValidRecordMapCamera(camera)).toBe(true);
  });

  it('should reject invalid map camera values', () => {
    expect(isValidRecordMapCamera({ ...camera, longitude: Infinity })).toBe(
      false,
    );
    expect(isValidRecordMapCamera({ ...camera, latitude: -91 })).toBe(false);
    expect(isValidRecordMapCamera({ ...camera, zoom: 23 })).toBe(false);
    expect(isValidRecordMapCamera({ ...camera, pitch: Number.NaN })).toBe(
      false,
    );
    expect(isValidRecordMapCamera({ ...camera, updatedAt: null })).toBe(false);
  });

  it('should use a persisted camera when it is valid', () => {
    expect(getInitialRecordMapCamera(camera)).toEqual(camera);
  });

  it('should fall back to the default camera when persisted camera is invalid', () => {
    expect(getInitialRecordMapCamera({ ...camera, zoom: 30 })).toEqual(
      DEFAULT_RECORD_MAP_CAMERA,
    );
  });

  it('should read and write valid map camera values by view id', () => {
    writeRecordMapCamera({
      camera,
      viewId: 'view-id',
    });

    expect(readRecordMapCamera('view-id')).toEqual(camera);
    expect(readRecordMapCamera('other-view-id')).toBeNull();
  });

  it('should ignore malformed stored map camera values', () => {
    window.localStorage.setItem('record-map-camera:view-id', '{not-json');

    expect(readRecordMapCamera('view-id')).toBeNull();

    window.localStorage.setItem(
      'record-map-camera:view-id',
      JSON.stringify({ ...camera, zoom: -1 }),
    );

    expect(readRecordMapCamera('view-id')).toBeNull();
  });
});
