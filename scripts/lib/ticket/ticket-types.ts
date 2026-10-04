// ticket-types.ts — the card types and whether each needs an implementation plan, from .claude/data/ticket-types.tsv.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dataRows } from '../data-rows.ts';

/**
 * Returns each type with `true` when it needs a plan. A missing data set throws instead of falling back to a built-in
 * list: a silent fallback would be the second copy this file exists to prevent.
 * @throws Error when .claude/data/ticket-types.tsv is missing.
 */
export function ticketTypes(root: string): Map<string, boolean> {
	const path = join(root, '.claude', 'data', 'ticket-types.tsv');
	if (!existsSync(path)) throw new Error('.claude/data/ticket-types.tsv is missing');
	return new Map(dataRows(path, 'type').flatMap(({ cells }) => (cells[0] ? [[cells[0], cells[1] !== 'no'] as const] : [])));
}
