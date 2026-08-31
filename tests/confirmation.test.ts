import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InlineConfirmation } from '../components/InlineConfirmation';

describe('inline confirmations', () => {
  it('keeps destructive choices visible inside the page', () => {
    const html = renderToStaticMarkup(createElement(InlineConfirmation, {
      confirmLabel: 'Confirm reversal',
      description: 'Points will be removed and the claim will return to review.',
      onCancel: () => undefined,
      onConfirm: () => undefined,
      title: 'Reverse this approval?',
    }));

    expect(html).toContain('Reverse this approval?');
    expect(html).toContain('Confirm reversal');
    expect(html).toContain('Keep approval');
  });
});
