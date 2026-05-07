const RECORD_ID_TOKEN = '{{recordId}}';
const ENCODED_RECORD_ID_TOKEN_REGEX = /%7B%7BrecordId%7D%7D/gi;

export const resolveIframeWidgetUrlRecordTokens = (
  url: string,
  recordId: string | undefined,
) => {
  if (!recordId) {
    return url;
  }

  const encodedRecordId = encodeURIComponent(recordId);

  return url
    .replaceAll(RECORD_ID_TOKEN, encodedRecordId)
    .replace(ENCODED_RECORD_ID_TOKEN_REGEX, encodedRecordId);
};
