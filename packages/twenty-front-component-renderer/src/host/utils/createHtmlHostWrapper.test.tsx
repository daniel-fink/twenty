import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createHtmlHostWrapper } from './createHtmlHostWrapper';

describe('createHtmlHostWrapper', () => {
  it('keeps iframes sandboxed by default', () => {
    const Iframe = createHtmlHostWrapper('iframe');

    expect(renderToStaticMarkup(<Iframe src="about:blank" />)).toContain(
      'sandbox=""',
    );
  });

  it('preserves explicit iframe sandbox permissions', () => {
    const Iframe = createHtmlHostWrapper('iframe');

    expect(
      renderToStaticMarkup(
        <Iframe sandbox="allow-scripts" src="about:blank" />,
      ),
    ).toContain('sandbox="allow-scripts"');
  });
});
