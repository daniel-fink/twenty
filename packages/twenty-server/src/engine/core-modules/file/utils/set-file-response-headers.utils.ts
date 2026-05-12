import { type Response } from 'express';

import { getContentDisposition } from 'src/engine/core-modules/file/utils/get-content-disposition.utils';

const PUBLIC_ASSET_INLINE_MIME_TYPES = new Set([
  'application/javascript',
  'font/woff',
  'font/woff2',
  'text/css',
  'text/javascript',
]);

const setResponseHeaders = ({
  getDisposition,
  mimeType,
  res,
}: {
  getDisposition: (contentType: string) => string;
  mimeType: string;
  res: Response;
}) => {
  const contentType = mimeType || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', getDisposition(contentType));
};

export const setFileResponseHeaders = (res: Response, mimeType: string) => {
  setResponseHeaders({
    getDisposition: getContentDisposition,
    mimeType,
    res,
  });
};

export const setPublicAssetResponseHeaders = (
  res: Response,
  mimeType: string,
) => {
  setResponseHeaders({
    getDisposition: (contentType) =>
      PUBLIC_ASSET_INLINE_MIME_TYPES.has(contentType)
        ? 'inline'
        : getContentDisposition(contentType),
    mimeType,
    res,
  });
};
