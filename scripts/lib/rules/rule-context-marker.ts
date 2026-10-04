// rule-context-marker.ts — where the rule-context hook remembers which area summaries a session has seen.

import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Returns the marker path for `session`; outside the repo, because .claude/state/ has exactly one writer. */
export function ruleContextMarker(session: string): string {
	return join(tmpdir(), `pixecutive-rule-context-${session.replace(/[^\w-]/g, '')}.json`);
}
