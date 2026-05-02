const getDefaultUrl = () => {
  if (
    window.location.hostname.endsWith('localhost') ||
    window.location.hostname.endsWith('127.0.0.1')
  ) {
    // In development environment front and backend usually run on separate ports
    // we set the default value to localhost:3000.
    // In dev context, we use env vars to overwrite it
    return `http://${window.location.hostname}:3000`;
  } else {
    // Outside of localhost we assume that they run on the same port
    // because the backend will serve the frontend
    // In prod context, we use index.html + window var to ovewrite it
    return `${window.location.protocol}//${window.location.hostname}${
      window.location.port ? `:${window.location.port}` : ''
    }`;
  }
};

export const REACT_APP_SERVER_BASE_URL =
  window._env_?.REACT_APP_SERVER_BASE_URL || getDefaultUrl();

export const DEFAULT_MAP_VIEW_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const getDefaultMapViewStyleUrl = () => {
  if (
    window.location.hostname.endsWith('localhost') ||
    window.location.hostname.endsWith('127.0.0.1')
  ) {
    return DEFAULT_MAP_VIEW_STYLE_URL;
  }

  return '';
};

export const REACT_APP_MAP_VIEW_STYLE_URL =
  window._env_?.REACT_APP_MAP_VIEW_STYLE_URL || getDefaultMapViewStyleUrl();
