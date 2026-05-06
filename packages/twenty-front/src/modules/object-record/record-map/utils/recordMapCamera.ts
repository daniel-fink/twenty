import { type RecordMapCamera } from '@/object-record/record-map/types/RecordMapCamera';
import { isDefined } from 'twenty-shared/utils';

export const DEFAULT_RECORD_MAP_CAMERA = {
  bearing: 0,
  latitude: 20,
  longitude: 0,
  pitch: 0,
  updatedAt: '',
  zoom: 1.4,
} satisfies RecordMapCamera;

const RECORD_MAP_CAMERA_STORAGE_KEY_PREFIX = 'record-map-camera';
const MIN_MAP_ZOOM = 0;
const MAX_MAP_ZOOM = 22;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidLongitude = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= MIN_LONGITUDE && value <= MAX_LONGITUDE;

const isValidLatitude = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= MIN_LATITUDE && value <= MAX_LATITUDE;

const isValidZoom = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= MIN_MAP_ZOOM && value <= MAX_MAP_ZOOM;

export const isValidRecordMapCamera = (
  value: unknown,
): value is RecordMapCamera => {
  if (!isDefined(value) || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<RecordMapCamera>;

  return (
    isValidLongitude(candidate.longitude) &&
    isValidLatitude(candidate.latitude) &&
    isValidZoom(candidate.zoom) &&
    isFiniteNumber(candidate.bearing) &&
    isFiniteNumber(candidate.pitch) &&
    typeof candidate.updatedAt === 'string'
  );
};

export const getInitialRecordMapCamera = (camera: unknown): RecordMapCamera =>
  isValidRecordMapCamera(camera) ? camera : DEFAULT_RECORD_MAP_CAMERA;

const getRecordMapCameraStorageKey = (viewId: string): string =>
  `${RECORD_MAP_CAMERA_STORAGE_KEY_PREFIX}:${viewId}`;

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readRecordMapCamera = (
  viewId: string | undefined,
): RecordMapCamera | null => {
  if (!isDefined(viewId) || viewId.length === 0) {
    return null;
  }

  const localStorage = getLocalStorage();

  if (!isDefined(localStorage)) {
    return null;
  }

  try {
    const storedCamera = localStorage.getItem(
      getRecordMapCameraStorageKey(viewId),
    );

    if (!isDefined(storedCamera)) {
      return null;
    }

    const parsedCamera = JSON.parse(storedCamera);

    return isValidRecordMapCamera(parsedCamera) ? parsedCamera : null;
  } catch {
    return null;
  }
};

export const writeRecordMapCamera = ({
  camera,
  viewId,
}: {
  camera: RecordMapCamera;
  viewId: string | undefined;
}) => {
  if (!isDefined(viewId) || viewId.length === 0) {
    return;
  }

  if (!isValidRecordMapCamera(camera)) {
    return;
  }

  const localStorage = getLocalStorage();

  if (!isDefined(localStorage)) {
    return;
  }

  try {
    localStorage.setItem(
      getRecordMapCameraStorageKey(viewId),
      JSON.stringify(camera),
    );
  } catch {
    return;
  }
};
