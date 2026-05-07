import { resolveIframeWidgetUrlRecordTokens } from '@/page-layout/widgets/iframe/utils/resolveIframeWidgetUrlRecordTokens';

describe('resolveIframeWidgetUrlRecordTokens', () => {
  it('should replace literal record id tokens', () => {
    const result = resolveIframeWidgetUrlRecordTokens(
      'https://example.com/embed?recordId={{recordId}}',
      'record-123',
    );

    expect(result).toBe('https://example.com/embed?recordId=record-123');
  });

  it('should replace URL-encoded record id tokens', () => {
    const result = resolveIframeWidgetUrlRecordTokens(
      'https://example.com/embed?recordId=%7B%7BrecordId%7D%7D',
      'record-123',
    );

    expect(result).toBe('https://example.com/embed?recordId=record-123');
  });

  it('should encode record ids before replacing tokens', () => {
    const result = resolveIframeWidgetUrlRecordTokens(
      'https://example.com/embed?recordId={{recordId}}',
      'record/id with spaces',
    );

    expect(result).toBe(
      'https://example.com/embed?recordId=record%2Fid%20with%20spaces',
    );
  });

  it('should leave URLs unchanged when no record id is available', () => {
    const url = 'https://example.com/embed?recordId={{recordId}}';

    expect(resolveIframeWidgetUrlRecordTokens(url, undefined)).toBe(url);
  });

  it('should leave URLs without tokens unchanged', () => {
    const url = 'https://example.com/embed?view=dashboard';

    expect(resolveIframeWidgetUrlRecordTokens(url, 'record-123')).toBe(url);
  });
});
