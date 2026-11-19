// Тексты статической разметки index.html. В самом HTML они английские — их
// видно до запуска скрипта; здесь их переписывают на текущий язык по
// атрибутам: `data-i18n` — текст, `data-i18n-title` — подсказка,
// `data-i18n-aria` — aria-label. Неизвестный ключ оставляет текст как есть.

import { hasKey, t } from '../i18n';

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
  root.title = t('app.title');
  for (const [attribute, apply] of ATTRIBUTES) {
    for (const node of root.querySelectorAll(`[${attribute}]`)) {
      const key = node.getAttribute(attribute) ?? '';
      if (node instanceof HTMLElement && hasKey(key)) apply(node, t(key));
    }
  }
}
