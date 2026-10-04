// merged-pull-request.ts — reads the number of the pull request a merge command names, so its base can be checked.

/** Returns the first number after `pulls/`, `pr merge ` or `merge ` in `command`, or null when it names none. */
export function mergedPullRequest(command: string): string | null {
	return /(?:pulls\/|pr merge |merge )([0-9]+)/.exec(command)?.[1] ?? null;
}
