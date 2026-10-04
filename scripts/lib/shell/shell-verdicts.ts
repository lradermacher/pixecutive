// shell-verdicts.ts — the words guard-shell answers with, one per class of damage that cannot be undone.

/** The verdicts of the shell guard; the hook holds one message per word and rejects a word it does not know. */
export const shellVerdict = Object.freeze({
	rm: 'RM',
	emptyVar: 'EMPTY_VAR',
	dataLoss: 'DATA_LOSS',
	forcePush: 'FORCE_PUSH',
	bypass: 'BYPASS',
	pipeToShell: 'PIPE_TO_SHELL',
	envWrite: 'ENV_WRITE',
	envRead: 'ENV_READ',
} as const);
export type ShellVerdict = (typeof shellVerdict)[keyof typeof shellVerdict];
