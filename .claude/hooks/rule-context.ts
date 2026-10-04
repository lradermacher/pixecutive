// rule-context.ts — injects the summary of an area's rule on the first write in that area, never blocks.

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { ruleContextMarker } from '../../scripts/lib/rules/rule-context-marker.ts';
import { rulesForPath } from '../../scripts/lib/rules/rules-for-path.ts';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0001-one-carrier-per-rule.md',
	event: 'PreToolUse',
	matcher: 'Edit|Write|NotebookEdit',
	stdin: 'tool_name, tool_input.file_path or tool_input.notebook_path, session_id',
	exit: '0 = done, with or without a summary · 1 = the rule loader is broken, shown to the user · never 2',
	probe: 'scripts/probe-rules.sh',
} as const;

// At most two summaries per event: a summary has up to 60 words and wraps to three lines in a terminal.
const maxRulesPerEvent = 2;

let payload: { tool_name?: unknown; session_id?: unknown; tool_input?: { file_path?: unknown; notebook_path?: unknown } };
try {
	payload = JSON.parse(readFileSync(0, 'utf8')) as typeof payload;
} catch {
	process.exit(0);
}
const target = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
if (!contract.matcher.split('|').includes(String(payload.tool_name)) || typeof target !== 'string' || target === '') {
	process.exit(0);
}

// `paths:` rules load when a matching file is read, not when a new one is created; this hook closes that gap.
// A lost marker only repeats a summary, the harmless outcome.
const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
const session = String(payload.session_id ?? process.env['CLAUDE_CODE_SESSION_ID'] ?? 'no-session');
const marker = ruleContextMarker(session);
let delivered: string[] = [];
try {
	delivered = (JSON.parse(readFileSync(marker, 'utf8')) as { delivered: string[] }).delivered;
} catch {
	delivered = [];
}

let due;
try {
	due = rulesForPath(target, root).filter((rule) => rule.patterns.length > 0 && !delivered.includes(rule.name));
} catch (error) {
	process.stderr.write(`⚠️ rule-context: the rule loader failed (${String(error)}); no area rule is injected on writes.\n`);
	process.exit(1);
}
if (due.length === 0) process.exit(0);

const lines = due.slice(0, maxRulesPerEvent).map((rule) => {
	delivered.push(rule.name);
	return `[${rule.name}] ${rule.summary.replace(/\s+/g, ' ')}  → full rule: ${rule.path}`;
});
try {
	writeFileSync(`${marker}.tmp`, JSON.stringify({ session, delivered }));
	renameSync(`${marker}.tmp`, marker);
} catch {
	// Without the marker the summary only comes a second time, the harmless outcome.
}
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: lines.join('\n') } }));
