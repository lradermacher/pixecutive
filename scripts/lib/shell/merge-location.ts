// merge-location.ts — finds the directory a local merge or reset runs in, so guard-state asks that checkout's branch.

const action = /(?<![\w/-])(?:merge|reset)(?![\w-])/;
const place = /\bgit\b\s+-C\s+([^\s;|&]+)|\b(?:cd|pushd)\s+([^\s;|&]+)|--git-dir[= ]([^\s;|&]+)/g;

/**
 * Returns the last `cd`, `pushd`, `git -C` or `--git-dir` target before the first merge or reset in `command`, or ''
 * when there is none and the hook's own working directory counts. The last one wins because a change of directory
 * holds until the command: `cd <scratchpad> && … && git merge` does not merge where the line started.
 */
export function mergeLocation(command: string): string {
	const found = action.exec(command);
	const head = found === null ? command : command.slice(0, found.index);
	let where = '';
	for (const match of head.matchAll(place)) where = match[1] ?? match[2] ?? match[3] ?? where;
	return where;
}
