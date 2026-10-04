// guard-transition.ts — the shared check of guard-inprogress and guard-done before a Jira transition.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import type { HookInput } from '../hooks/read-hook-input.ts';
import { verdictStage, type VerdictStage } from './card-verdict.ts';
import { trackerTransitions } from './tracker-config.ts';

/**
 * Returns the exit code and message for a transition hook at `stage`. Only the transition ID leading to In Progress
 * (entry) or Done (exit) is judged, by ticket.ts; everything a hook cannot read is a rejection, never a pass.
 */
export function guardTransition(input: HookInput | null, stage: VerdictStage, root: string, tool: string): { code: number; message: string } {
	if (input === null) return { code: 2, message: '⛔ The hook input could not be read; an unknown transition could lead anywhere.' };
	if (input.toolName !== tool) return { code: 0, message: '' };
	if (/\s/.test(input.issueKey + input.transitionId + input.sessionId)) {
		return { code: 2, message: '⛔ A field of the transition contains whitespace; the fields cannot be told apart reliably.' };
	}
	if (input.transitionId === '') return { code: 2, message: '⛔ The transition names no transition.id, so its target is unknown.' };
	const transitions = trackerTransitions(root);
	if ('problem' in transitions) return { code: 2, message: `⛔ The transition IDs are unknown: ${transitions.problem}` };
	const target = stage === verdictStage.entry ? transitions.inProgress : transitions.done;
	if (input.transitionId !== target) return { code: 0, message: '' };
	if (input.issueKey === '') return { code: 2, message: '⛔ The transition names no issueIdOrKey, so the plan cannot be found.' };
	const run = spawnSync('node', [join(root, 'scripts/ticket.ts'), stage === verdictStage.entry ? 'plan-required' : 'boxes', input.issueKey, '--session', input.sessionId], {
		cwd: root,
		encoding: 'utf8',
		env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...(input.sessionId ? { CLAUDE_CODE_SESSION_ID: input.sessionId } : {}) },
	});
	if (run.status === 0) return { code: 0, message: '' };
	const where = stage === verdictStage.entry ? 'In Progress' : 'Done';
	return { code: 2, message: `⛔ '${input.issueKey}' does not move to ${where}:\n${run.stdout}${run.stderr}` };
}
