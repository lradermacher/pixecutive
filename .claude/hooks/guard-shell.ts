// guard-shell.ts — rejects Bash commands whose damage cannot be undone: recursive rm outside the repo, force push,
// hook bypass, a download piped into a shell, volume and mirror deletes, and any write or read of `.env`.

import { readFileSync } from 'node:fs';
import type { ShellVerdict } from '../../scripts/lib/shell/shell-verdicts.ts';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0010-security-in-agent-operation.md',
	event: 'PreToolUse',
	matcher: 'Bash',
	stdin: 'tool_name, tool_input.command',
	exit: '0 = pass · 2 = an irreversible command, or the guard could not judge · anything else = an error in the hook',
	probe: 'scripts/probe-commands.ts',
} as const;

const messages: Record<ShellVerdict, string> = {
	RM:
		"'rm -rf' on an absolute or home path is rejected (ADR 0010); inside the repo rm stays allowed. " +
		'If it must happen, the maintainer runs it in their own terminal.',
	EMPTY_VAR:
		"'rm -rf' on a path that starts with a variable is rejected: empty, it deletes below the root. " +
		'Write ${DIR:?} instead of $DIR so the shell aborts first.',
	DATA_LOSS:
		"That deletes data that cannot be recovered: 'down -v' takes the named volumes, 'rsync --delete' empties " +
		"the target. Look without '-v' or with '--dry-run' first, then ask the maintainer.",
	FORCE_PUSH:
		"A force push is rejected in every spelling, '--force-with-lease' and '+ref:' included (ADR 0004): it " +
		'overwrites the work of others. The way to main is the pull request.',
	BYPASS:
		"'--no-verify' and setting 'core.hooksPath' switch the git hooks off, and the push lock with them " +
		'(ADR 0010). A missing push window is opened by the maintainer with /push.',
	PIPE_TO_SHELL:
		'A download piped into a shell runs code nobody has read, with my rights (ADR 0010). ' +
		'Download it, read it, then run it.',
	ENV_WRITE: 'Writing .env through the shell is rejected (ADR 0010); .env.example is allowed and is kept up to date.',
	ENV_READ:
		'.env and the environment of a container are not read (ADR 0010). Credentials come from the maintainer; ' +
		'a program gets them with --env-file, without the content entering the session.',
};

type Payload = { tool_name?: unknown; tool_input?: { command?: unknown } } | null;
let command = '';
try {
	const payload = JSON.parse(readFileSync(0, 'utf8')) as Payload;
	if (payload?.tool_name !== contract.matcher) process.exit(0);
	command = typeof payload.tool_input?.command === 'string' ? payload.tool_input.command : '';
} catch {
	process.exit(0);
}

// The library loads inside the try: a syntax error in it must reject, since exit 1 would let the command run.
let verdict: string | null;
try {
	const { judgeShell } = await import('../../scripts/lib/shell/judge-shell.ts');
	verdict = judgeShell(command);
} catch (error) {
	process.stderr.write(`⛔ guard-shell could not judge the command (${String(error)}); it rejects instead.\n`);
	process.exit(2);
}
if (verdict === null) process.exit(0);
const message = (messages as Record<string, string | undefined>)[verdict];
process.stderr.write(`⛔ ${message ?? `guard-shell knows no message for '${verdict}', which is no approval.`}\n`);
process.exit(2);
