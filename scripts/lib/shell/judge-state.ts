// judge-state.ts — the verdict behind guard-state: the signing key, the maintainer's windows, merges, moves of
// `main`, discarded work and writes into .claude/state/. Whether a local merge hits `main` is the hook's question.

import { hit, lexCommand, onlyMentioned, segmentBounds } from './command-lexer.ts';
import { type StateVerdict, stateVerdict } from './state-verdicts.ts';

// It hangs on the folder too: `cat ~/.claude/pixecutive/*` reaches the key without its name.
const signingKey = /state\.key|\.claude\/pixecutive\b/;
// The lock hangs on the subcommand, not the path: `T=scripts/ticket.ts; node $T push-ok` hides the path.
const unblock = /(?<![\w/-])unblock(?![\w-])/;
const pushApproval = /(?<![\w/-])push-ok(?![\w-])/;
// Running the window hooks by hand would forge the maintainer's approval; reading, adding or listing them is fine.
// No interpreter right after a dot or word: the `sh` that ends `guard-state.sh` is no call.
const hookRunner = /(?:^|[;&|\n(`]\s*|(?<![\w./-])(?:bash|sh|zsh|exec|source|node)\s+(?:-\S+\s+)*|(?<![\w.])\.\s+)/;
const hookCall = new RegExp(hookRunner.source + /[^\s;|&]*(?:push-window|unblock-window)\.ts/.source);

// For `gh pr … merge` quoting decides: a quoted `merge` is a search word. For `gh api` the method decides.
const mergeQuotedCounts = [/\bgh\b[^|;&]*\bpr\b[^|;&]*?\bmerge\b/g];
const mergeAlways = [
	/\/pulls\/\d+\/merge\b/g,
	/\/merges\b/g,
	/\bgh\b[^|;&]*\bapi\b[^|;&]*--method\s+(?:PUT|POST)[^|;&]*(?:merge|Merge)(?![a-z_])/g,
	/\bgh\b[^|;&]*\bapi\b[^|;&]*\bmutation\b[^|;&]*(?:merge|Merge)(?![a-z_])/g,
];

// These move the checked-out branch without any hook. A whole word: `git merge-base` and `feat/x-merge-y` are none.
const branchMover = /(?<![\w/-])(?:merge|pull|cherry-pick|revert|rebase|am)(?![\w-])/.source;
const movesTheBranch = [
	new RegExp(`\\bgit\\b[^|;&]*${branchMover}(?![^|;&]*--(?:abort|continue|quit|skip))`),
	/\bgit\b[^|;&]*\bcommit\b[^|;&]*--amend/,
	/\bgit\b[^|;&]*\bstash\b[^|;&]*\b(?:pop|apply)\b/,
];
const switchesToMain = /\bgit\b[^|;&]*\b(?:switch|checkout)\b[^|;&]*\s(?:-[bBcC]\s+)?(?:main|master)(?=\s|$)/;

// The name must be main, not contain it: `git branch -f feature-main-test` is allowed. A fetch is judged by its source.
const main = /(?:refs\/heads\/)?(?:main|master)(?=\s|$|["'])/.source;
const movesMain = [
	new RegExp(/\bgit\b[^|;&]*\bbranch\b[^|;&]*(?:-f|--force)\s+/.source + main),
	/\bgit\b[^|;&]*\bupdate-ref\b[^|;&]*\srefs\/heads\/(?:main|master)(?=\s|$)/,
	/\bgit\b[^|;&]*\bsymbolic-ref\b[^|;&]*\srefs\/heads\/(?:main|master)(?=\s|$)/,
	new RegExp(/\bgit\b[^|;&]*\b(?:checkout|switch)\b[^|;&]*\s-[BC]\s+/.source + main),
	new RegExp(/\bgit\b[^|;&]*\bfetch\b[^|;&]*\s(?!(?:refs\/heads\/)?(?:main|master):)[^\s:|;&]+:/.source + main),
	/\bgh\b[^|;&]*\bapi\b[^|;&]*--method\s+(?:PATCH|DELETE)[^|;&]*git\/refs\/heads\/(?:main|master)\b/,
];

const untracked = /\bgit\b[^|;&]*\bclean\b[^|;&]*(?:-[A-Za-z]*f|--force)/;
// One path may be restored; the sweep over everything changed may not, on any branch.
// Taking files out of the index discards nothing.
const discard = [
	/\bgit\b[^|;&]*\brestore\b(?![^|;&]*(?:--staged|\s-S\b)(?![^|;&]*(?:--worktree|\s-W\b)))[^|;&]*\s(?:\.|:\/)(?=\s|$)/,
	/\bgit\b[^|;&]*(?<![\w/-])reset(?![\w-])[^|;&]*--hard/,
	/\bgit\b[^|;&]*\bcheckout\b[^|;&]*\s(?:--\s+)?(?:\.|:\/)(?=\s|$)/,
	/\bgit\b[^|;&]*\bcheckout\b[^|;&]*\s-f(?![A-Za-z])/,
	/\bgit\b[^|;&]*\bstash\b[^|;&]*\bclear\b/,
];

// The target is the next word after the operator, flags allowed in between; `state` ends at a path boundary.
const writers = ['tee', 'rm', 'mv', 'cp', 'touch', 'truncate', 'install', 'ln', 'chmod', 'mkdir', 'dd', 'cd', 'pushd'];
const operators = `(?:[0-9]*&?>{1,2}\\|?|\\b(?:${writers.join('|')})\\b)`;
const stateDir = /\.claude\/+(?:\.\/)*state(?![A-Za-z0-9_-])/.source;
const nearStateDir = /[^\n|;&]*[\s=][^\s;|&]*/.source + stateDir;
const stateWrites = [
	new RegExp(`${operators}${/[ \t]*(?:-{1,2}[^\s]+[ \t]+)*["']?[^\s"';|&]*/.source}${stateDir}`),
	// Without the `.claude/` literal as well: `cd .claude && echo x > state/p.json`.
	new RegExp(`${operators}${/[ \t]*(?:-{1,2}[^\s]+[ \t]+)*["']?state\/[A-Za-z0-9_.-]+\.json\b/.source}`),
	// Two-argument commands, flags with a value and `sed -i`: the same line counts as near enough.
	new RegExp(/\b(?:cp|mv|install|ln|rsync|truncate|chmod|chown|dd|shred|tee|split)\b/.source + nearStateDir),
	new RegExp(/\b(?:sed|perl|ruby)\b[^\n|;&]*\s-[A-Za-z]*i/.source + /[^\n|;&]*/.source + stateDir),
];

// An interpreter that only reads the state is allowed. It counts once its own command calls a writing function of a
// file module, opens a file for writing, or redirects outside quotes; a `;` inside its quoted script is no boundary.
const fileModule = String.raw`(?:fs|os|shutil|pathlib|File|FileUtils|Path\([^)]*\)|require\(\s*['"](?:node:)?fs['"]\s*\)|__import__\(\s*['"](?:os|shutil)['"]\s*\))`;
const writingCall = new RegExp(
	`${fileModule}\\.(?:writeFile|appendFile|createWriteStream|unlink|rm|rmdir|rmtree|remove|rename|replace|mkdir|makedirs|copy|cp|move|truncate|write_text|write_bytes|write|delete|symlink|chmod)\\w*\\s*\\(|open\\s*\\([^)]*["'][wax+]|\\bprint\\s*>{1,2}`,
);
function interpreterWritesState(command: string): boolean {
	const { quoted } = lexCommand(command);
	for (const interpreter of command.matchAll(/\b(?:python3?|perl|ruby|node|awk)\b/g)) {
		if (onlyMentioned(command, interpreter.index, interpreter.index + interpreter[0].length)) continue;
		const [, end] = segmentBounds(command, interpreter.index);
		const own = command.slice(interpreter.index, end);
		if (!new RegExp(stateDir).test(own)) continue;
		const redirects = [...own.matchAll(/>/g)].some((match) => !quoted[interpreter.index + match.index]);
		if (writingCall.test(own) || redirects) return true;
	}
	return false;
}

// `--help` holds per segment: a word of another command must never lift the rule for this one.
function mergesWithoutHelp(text: string): boolean {
	const { quoted, substitution } = lexCommand(text);
	const groups: Array<{ patterns: readonly RegExp[]; quotingCounts: boolean }> = [
		{ patterns: mergeQuotedCounts, quotingCounts: true },
		{ patterns: mergeAlways, quotingCounts: false },
	];
	for (const { patterns, quotingCounts } of groups) {
		for (const pattern of patterns) {
			for (const match of text.matchAll(pattern)) {
				if (quotingCounts) {
					const word = /(?:merge|Merge)s?\b/.exec(match[0]);
					const position = match.index + (word?.index ?? 0);
					if (quoted[position] && !substitution[position]) continue;
				}
				if (onlyMentioned(text, match.index, match.index + match[0].length)) continue;
				const [begin, end] = segmentBounds(text, match.index);
				if (/--help\b|\s-h\b/.test(text.slice(begin, end))) continue;
				return true;
			}
		}
	}
	return false;
}

function anyHit(patterns: readonly RegExp[], command: string): boolean {
	return patterns.some((pattern) => hit(pattern, command));
}

/**
 * Returns the first verdict `command` earns, or null. LOCAL_MERGE means a merge-like command whose harm depends on the
 * branch checked out where it runs, which the caller decides; ONTO_MAIN means the command switches to `main` itself.
 */
export function judgeState(command: string): StateVerdict | null {
	// Reading counts here: an exception for readers in front of a lock against reading would lift the lock.
	if (hit(signingKey, command, false)) return stateVerdict.signingKey;
	if (hit(unblock, command)) return stateVerdict.unblock;
	if (hit(pushApproval, command)) return stateVerdict.pushApproval;
	if (hit(hookCall, command)) return stateVerdict.hookCall;
	if (mergesWithoutHelp(command)) return stateVerdict.merge;
	if (anyHit(movesTheBranch, command)) {
		return hit(switchesToMain, command) ? stateVerdict.ontoMain : stateVerdict.localMerge;
	}
	if (anyHit(movesMain, command)) return stateVerdict.movesMain;
	if (hit(untracked, command)) return stateVerdict.untracked;
	if (anyHit(discard, command)) return stateVerdict.discard;
	if (anyHit(stateWrites, command) || interpreterWritesState(command)) return stateVerdict.state;
	return null;
}
