// The browser scripts' harness is the kit's (`maker-kit/harness`): flags,
// vite on the project's own ports with --strictPort (it rebuilds before
// `--preview`; a busy preview port is an error), pages collecting console
// errors, steps and the run. Only MathSculpt's ports are here. The rule of
// the repository: no throwaway scripts — extend these (CLAUDE.md).
//
// The browser is Playwright's own, or `PLAYWRIGHT_BROWSER` (a chromium's
// path): in a cloud container Playwright looks for another build than the
// installed one.

import { launch as kitLaunch } from 'maker-kit/harness';

export { binaryStl, check, download, horizontalOverflow, offline, parseArgs, settled, VIEWPORTS } from 'maker-kit/harness';

/**
 * MathSculpt's own ports, with --strictPort: another project's server on
 * 5173/4173 is never tested by mistake (the taken ones: the kit's
 * docs/harness.md).
 */
export const PORTS = { dev: 5287, preview: 4287 };

/** The kit's `launch` on MathSculpt's ports. */
export const launch = ({ preview = false } = {}) => kitLaunch({ preview, ports: PORTS });
