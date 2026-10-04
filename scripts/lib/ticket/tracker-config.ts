// tracker-config.ts — the measured Jira transition IDs of this checkout, from the gitignored local config.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Returns the transition IDs that lead to In Progress and Done, or the reason they are unknown. Unknown is a
 * reason to reject a transition, never to let it pass: a hook that cannot tell the target cannot judge it.
 */
export function trackerTransitions(root: string): { inProgress: string; done: string } | { problem: string } {
	const path = process.env['PIXECUTIVE_LOCAL_CONFIG'] ?? join(root, 'pixecutive.local.json');
	if (!existsSync(path)) return { problem: `${path} is missing; copy pixecutive.local.example.json and fill in tracker` };
	try {
		const transitions = (JSON.parse(readFileSync(path, 'utf8')) as { tracker?: { transitions?: Record<string, unknown> } }).tracker
			?.transitions;
		const inProgress = transitions?.['inProgress'];
		const done = transitions?.['done'];
		if (typeof inProgress !== 'string' || typeof done !== 'string') return { problem: `${path}: tracker.transitions.inProgress and .done are required` };
		return { inProgress, done };
	} catch {
		return { problem: `${path} is not valid JSON` };
	}
}
