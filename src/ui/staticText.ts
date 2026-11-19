// The texts of index.html's static markup, and the page's language and
// direction. In the HTML itself they are English — seen before the script
// runs; here they are rewritten into the current language by attributes:
// `data-i18n` the text, `data-i18n-title` the tooltip, `data-i18n-aria` the
// aria-label. An unknown key leaves the text as it is.

import { direction, hasKey, lang, t } from '../i18n';

const ATTRIBUTES: readonly [string, (node: HTMLElement, text: string) => void][] = [
  [
    'data-i18n',
    (node, text) => {
      node.textContent = text;
    },
  ],
  [
    'data-i18n-title',
    (node, text) => {
      node.title = text;
    },
  ],
  ['data-i18n-aria', (node, text) => node.setAttribute('aria-label', text)],
];

export function applyStaticText(root: Document): void {
  // Hebrew mirrors the whole page; the CSS uses logical properties only
  root.documentElement.lang = lang();
  root.documentElement.dir = direction(lang());
  root.title = t('app.title');
  for (const [attribute, apply] of ATTRIBUTES) {
    for (const node of root.querySelectorAll(`[${attribute}]`)) {
      const key = node.getAttribute(attribute) ?? '';
      if (node instanceof HTMLElement && hasKey(key)) apply(node, t(key));
    }
  }
}
