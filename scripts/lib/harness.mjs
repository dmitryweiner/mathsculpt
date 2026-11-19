// Обвязка браузерных скриптов — китовая (`maker-kit/harness`): разбор
// флагов, свой vite на своих портах со --strictPort (перед `--preview` сам
// пересобирает, занятый порт превью — ошибка), страницы со сбором ошибок
// консоли, шаги и прогон. Здесь — только порты MathSculpt. Правило
// репозитория — не плодить одноразовые скрипты, а расширять эти (CLAUDE.md).
//
// Браузер — Playwright по умолчанию либо из `PLAYWRIGHT_BROWSER` (путь к
// исполняемому chromium): в облачном контейнере Playwright ищет не ту
// сборку, что предустановлена.

import { launch as kitLaunch } from 'maker-kit/harness';

export { binaryStl, check, download, horizontalOverflow, offline, parseArgs, settled, VIEWPORTS } from 'maker-kit/harness';

/**
 * Порты MathSculpt — свои, со --strictPort: сервер другого проекта на
 * 5173/4173 по ошибке не проверится (занятые — в docs/harness.md кита).
 */
export const PORTS = { dev: 5287, preview: 4287 };

/** `launch` кита на портах MathSculpt. */
export const launch = ({ preview = false } = {}) => kitLaunch({ preview, ports: PORTS });
