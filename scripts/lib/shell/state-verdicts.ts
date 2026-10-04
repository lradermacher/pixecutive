// state-verdicts.ts — the words guard-state answers with: the key, the windows, main, the work tree and the state.

/** The verdicts of the state guard; the hook holds one message per word and rejects a word it does not know. */
export const stateVerdict = Object.freeze({
	signingKey: 'SIGNING_KEY',
	unblock: 'UNBLOCK',
	hookCall: 'HOOK_CALL',
	pushApproval: 'PUSH_APPROVAL',
	merge: 'MERGE',
	ontoMain: 'ONTO_MAIN',
	localMerge: 'LOCAL_MERGE',
	movesMain: 'MOVES_MAIN',
	untracked: 'UNTRACKED',
	discard: 'DISCARD',
	state: 'STATE',
} as const);
export type StateVerdict = (typeof stateVerdict)[keyof typeof stateVerdict];
