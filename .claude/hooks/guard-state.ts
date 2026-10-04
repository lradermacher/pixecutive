// guard-state.ts — keeps the model away from .claude/state/, the signing key and the maintainer's own approvals,
// rejects discarding work, and lets `main` move only through a pull request; a merge needs the open push window.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { StateVerdict } from '../../scripts/lib/shell/state-verdicts.ts';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0010-security-in-agent-operation.md',
	event: 'PreToolUse',
	matcher: 'Bash',
	stdin: 'tool_name, tool_input.command, session_id',
	exit: '0 = pass · 2 = a forbidden command, or the guard could not judge · anything else = an error in the hook',
	probe: 'scripts/probe-commands.ts',
} as const;

const toMain = 'The way to main is the pull request the maintainer merges.';
const messages: Record<StateVerdict, string> = {
	SIGNING_KEY:
		'The signing key of the session state is not touched: whoever reads it can sign any state, ' +
		'and the ticket requirement becomes prose (ADR 0003).',
	UNBLOCK: 'The escape window is opened by the maintainer, not by me: they type /unblock <reason> (ADR 0003).',
	HOOK_CALL:
		"The window hooks are never run by hand: they record the maintainer's approval and rely on a real prompt " +
		'triggering them. A call from the shell would be a forged approval (ADR 0010).',
	PUSH_APPROVAL: 'The push approval comes from the maintainer typing /push (ADR 0004); committing needs none.',
	MERGE:
		"Merging without the maintainer's approval is rejected (ADR 0004): it needs the same window as a push. " +
		'Without one the pull request waits for the maintainer.',
	ONTO_MAIN: `The command switches to 'main' and works on there; a fast-forward runs no hook at all. ${toMain}`,
	LOCAL_MERGE: `A merge, pull, rebase or reset on 'main' is rejected: a fast-forward runs no hook (ADR 0004). ${toMain}`,
	MOVES_MAIN:
		"That moves 'main' directly, without a merge and without any hook ('branch -f', 'update-ref', " +
		`'fetch …:main', the refs API). ${toMain}`,
	UNTRACKED:
		"'git clean -f' deletes untracked files, which cannot be recovered. " +
		"Look with 'git clean -nd' first, then ask the maintainer.",
	DISCARD:
		"That throws away every changed file at once ('git restore .', 'git checkout -- .', 'checkout -f', " +
		"'stash clear'). Name a single path, or run 'git stash push' first.",
	STATE:
		'Only scripts/ticket.ts writes .claude/state/ (ADR 0003): the session state is not set by the one it binds. ' +
		'Reading it stays allowed.',
};

function reject(message: string): never {
	process.stderr.write(`⛔ ${message}\n`);
	process.exit(2);
}

function git(args: readonly string[]): string {
	try {
		return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return '';
	}
}

type Payload = { tool_name?: unknown; session_id?: unknown; tool_input?: { command?: unknown } } | null;
let command = '';
let session = '';
try {
	const payload = JSON.parse(readFileSync(0, 'utf8')) as Payload;
	if (payload?.tool_name !== contract.matcher) process.exit(0);
	command = typeof payload.tool_input?.command === 'string' ? payload.tool_input.command : '';
	session = typeof payload.session_id === 'string' ? payload.session_id : '';
} catch {
	process.exit(0);
}

// The library loads inside the try: a syntax error in it must reject, since exit 1 would let the command run.
let verdict: string | null;
let location = '';
let pullRequest: string | null = null;
try {
	const { judgeState } = await import('../../scripts/lib/shell/judge-state.ts');
	const { mergeLocation } = await import('../../scripts/lib/shell/merge-location.ts');
	const { mergedPullRequest } = await import('../../scripts/lib/shell/merged-pull-request.ts');
	verdict = judgeState(command);
	location = mergeLocation(command);
	pullRequest = mergedPullRequest(command);
} catch (error) {
	reject(`guard-state could not judge the command (${String(error)}); it rejects instead.`);
}
if (verdict === null) process.exit(0);

// A merge or reset harms only on `main`, asked where it runs: `cd ../wt && git merge` uses that checkout's branch.
// A directory the command creates itself does not exist yet, and a branch that cannot be read counts as `main`.
if (verdict === 'LOCAL_MERGE') {
	let branch = '';
	if (location === '') branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
	else if (existsSync(location) && statSync(location).isDirectory()) {
		branch = git(['-C', location, 'rev-parse', '--abbrev-ref', 'HEAD']);
	}
	if (branch !== '' && branch !== 'main' && branch !== 'master') process.exit(0);
	reject(messages.LOCAL_MERGE);
}

// The window is asked first, so a closed one costs no network call; with it open, a merge into `main` still is no.
if (verdict === 'MERGE') {
	const root = process.env['CLAUDE_PROJECT_DIR'] || git(['rev-parse', '--show-toplevel']);
	const approval = root === '' ? null : spawnSync('node', [join(root, 'scripts/ticket.ts'), 'push-allowed', session]);
	if (approval === null || approval.status !== 0) reject(messages.MERGE);
	if (/\bbase=(?:main|master)\b/.test(command)) reject(`A merge into 'main' is rejected whatever the window. ${toMain}`);
	const target = pullRequest === null ? [] : [pullRequest];
	const view = spawnSync('gh', ['pr', 'view', ...target, '--json', 'baseRefName', '--jq', '.baseRefName'], {
		encoding: 'utf8',
	});
	const base = view.status === 0 ? view.stdout.trim() : '';
	if (base === '') reject('guard-state could not read the base branch of the pull request, so the merge is rejected.');
	if (base === 'main' || base === 'master') reject(`A merge into '${base}' is rejected whatever the window. ${toMain}`);
	process.exit(0);
}

const message = (messages as Record<string, string | undefined>)[verdict];
reject(message ?? `guard-state knows no message for '${verdict}', which is no approval.`);
