// judge-shell.ts — the verdict behind guard-shell: damage that cannot be undone, read from the full command text.
// Recursive rm outside the repo, force push, hook bypass, download into a shell, volume and mirror deletes, `.env`.

import { heredocOpener, hit, onlyMentioned, segmentBounds } from './command-lexer.ts';
import { type ShellVerdict, shellVerdict } from './shell-verdicts.ts';

const rmRecursive = /\brm\b(?:\s+-{1,2}[A-Za-z-]+)*\s+-{0,2}[A-Za-z]*[rR][A-Za-z]*\b[^|;&]*?/.source;
const rmAbsolute = new RegExp(`(?<![-\\w])${rmRecursive}${/\s+["']?(?:\/|~|\$HOME|\$\{HOME\})/.source}`);
// `$PWD` is never empty, and a path starting with `./` cannot reach outside the working directory.
const rmVariable = new RegExp(rmRecursive + /(?<![./\w])["']?\$\{?(?!PWD\b)[A-Za-z_][A-Za-z0-9_]*\}?["']?\//.source);
// The session scratchpad lies outside the repo, and every probe file of the harness lands there. A `..` in the
// path could climb out of it, so such a path is no scratchpad.
const scratchPath =
	/(?<=\s)["']?(?:\/private)?\/(?:tmp|var\/folders)\/(?![^\s"';|&]*\.\.)[^\s"';|&]*claude[^\s"';|&]*["']?/g;

const dataLoss = [
	/\bdocker\b[^|;&]*\b(?:compose|stack)\b[^|;&]*\bdown\b[^|;&]*(?:\s-\w*v|--volumes)/,
	/\brsync\b(?![^|;&]*--dry-run)(?![^|;&]*\s-\w*n\b)[^|;&]*--delete/,
];
// `--force-with-lease` overwrites the work of others as well, and `+HEAD:main` is a force push without any flag.
const forcePush = [
	/\bgit\b[^|;&]*\bpush\b[^|;&]*(?:--force(?:-with-lease)?|\s-f\b)/,
	/\bgit\b[^|;&]*\bpush\b[^|;&]*\s-\w*f\w*\b/,
	/\bgit\b[^|;&]*\bpush\b[^|;&]*\s\+[A-Za-z0-9_./-]+:/,
];
// Setting, unsetting or overriding `core.hooksPath` is a bypass; reading it is how the lock is understood.
const bypass = [
	/\bgit\b[^|;&]*\bpush\b[^|;&]*--no-verify/,
	/\bgit\b[^|;&]*\bcommit\b[^|;&]*(?:--no-verify|\s-[A-Za-z]*n[A-Za-z]*\b)/,
	/\bgit\b[^|;&]*\bconfig\b[^|;&]*--unset(?:-all)?\s+core\.hooksPath/,
	/\bgit\b[^|;&]*\s-c\s+core\.hooksPath=/,
	/\bgit\b[^|;&]*\bconfig\b(?![^|;&]*--(?:get|list))[^|;&]*core\.hooksPath[ \t]+(?![0-9]*[<>])\S/,
];
// A shell anywhere in the same pipe runs the download; a language with a program of its own only formats it.
const pipeToShell = new RegExp(
	[
		/\b(?:curl|wget)\b[^;&\n]*\|[^;&\n]*(?:^|[|\s])(?:sudo\s+(?:-\S+\s+)*)?(?:[^\s|;&]*\/)?/,
		/(?:(?:ba|z|k|da)?sh\b|(?:python3?|perl|ruby|node)\s*(?:-\s*)?(?:$|[|;&\n])|node\s+--input-type)/,
	]
		.map((part) => part.source)
		.join(''),
);

// No word character, dash or backslash before it: `process.env.R` and `process\.env` are identifiers, not files.
const envName = /(?<![\w\-\\])\.env\b(?!\.example)/.source;
const envWriters = /(?:[0-9]*&?>{1,2}\|?|\btee\b|\brm\b|\bmv\b|\bcp\b|\btruncate\b|\bdd\b|\bchmod\b)/.source;
const envWrites = [
	new RegExp(envWriters + /[ \t]*(?:-{1,2}[^\s]+[ \t]+)*[^\s;|&]*/.source + envName),
	// A second argument or a flag with a separate value breaks "the target is the next word"; one line is near enough.
	new RegExp(/\b(?:cp|mv|install|ln|rsync)\b[^\n|;&]*[\s/][.]?[^\s;|&]*/.source + envName),
	new RegExp(/\b(?:truncate|chmod|chown|dd|shred|ln|split|tee)\b[^\n|;&]*[\s=][^\s;|&]*/.source + envName),
	new RegExp(/\b(?:sed|perl|ruby)\b[^\n|;&]*-[A-Za-z]*i[^\n|;&]*/.source + envName),
	// Only writing: `--env-file .env.local` and `open('.env').read()` read, and reading is the next verdict.
	new RegExp(/\b(?:python3?|perl|ruby|node)\b[^\n|;&]*/.source + envName + /[^\n|;&]*["'][wa]\+?["']/.source),
	new RegExp(/\b(?:python3?|perl|ruby|node)\b[^\n|;&]*["'][wa]\+?["'][^\n|;&]*/.source + envName),
];
const fileFunctions = [
	'writeFileSync',
	'writeFile',
	'appendFileSync',
	'appendFile',
	'createWriteStream',
	'copyFileSync',
	'copyFile',
	'renameSync',
	'rename',
	'unlinkSync',
	'unlink',
	'rmSync',
	'truncateSync',
];
const nodeFileCall = new RegExp(`\\b(${fileFunctions.join('|')})\\s*\\(`, 'g');
const pathCall = /\bPath\s*\(/g;
const pathWrite = /^\s*\.\s*(?:write_text|write_bytes|unlink|touch|rename|replace|open\s*\(\s*\\?["'][wa])/;

const envFile = /(?<![\w.\-\\])\.env(?!\.example)(?:\.[A-Za-z0-9_-]+)?(?![\w.-])/.source;
const readCommand = /\b(?:cat|head|tail|less|more|source)\b/.source;
const dotCommand = /(?:^|(?<=[;&|({\n]))[ \t]*(?:(?:then|do|else)[ \t]+)?\.(?=\s)/.source;
const envReaders = `(?:${readCommand}|${dotCommand})`;
const containerEnv = [
	/\bdocker\b(?:\s+compose)?[^\n|;&]*?\bexec\b(?:\s+-{1,2}\S+)*\s+[^\s-]\S*\s+/,
	/(?:(?:sh|bash)\s+-c\s+["']?)?(?:env|printenv)\b/,
];
const envReads = [
	new RegExp(envReaders + /[^\n|;&]*?(?:^|(?<=[\s/"'=]))(?:\.\/)?/.source + envFile, 'g'),
	new RegExp(containerEnv.map((part) => part.source).join(''), 'g'),
	// Without a format `inspect` shows the whole environment; with one, or with the output discarded, it does not.
	/\bdocker\s+(?:container\s+)?inspect\b(?!(?:[^\n|;&]|&(?=>))*(?:\s-f\b|--format\b|>\s*\/dev\/null))/g,
	/\bdocker\s+(?:container\s+)?inspect\b[^\n|;&]*\bEnv\b/g,
];

function anyHit(patterns: readonly RegExp[], command: string): boolean {
	return patterns.some((pattern) => hit(pattern, command));
}

// The scratchpad exception holds per segment and per path: one scratchpad path must not clear `rm -rf ~/` beside it.
function removesOutside(pattern: RegExp, command: string): boolean {
	for (const match of command.matchAll(new RegExp(pattern.source, 'g'))) {
		if (onlyMentioned(command, match.index, match.index + match[0].length)) continue;
		const [begin, end] = segmentBounds(command, match.index);
		if (pattern.test(command.slice(begin, end).replace(scratchPath, 'scratch'))) return true;
	}
	return false;
}

function callArguments(text: string, start: number): { args: string[]; end: number } {
	const args: string[] = [];
	let current = '';
	let depth = 0;
	let quote = '';
	for (let index = start; index < text.length; index += 1) {
		const char = text[index] ?? '';
		if (quote !== '') {
			if (char === quote && text[index - 1] !== '\\') quote = '';
		} else if ('"\'`'.includes(char)) {
			quote = char;
		} else if ('([{'.includes(char)) {
			depth += 1;
		} else if (')]}'.includes(char)) {
			if (depth === 0) return { args: [...args, current], end: index + 1 };
			depth -= 1;
		} else if (char === ',' && depth === 0) {
			args.push(current);
			current = '';
			continue;
		} else if (char === '\n') {
			break;
		}
		current += char;
	}
	return { args: [...args, current], end: text.length };
}

// The file functions of Node and Python's Path need no `'w'`: the target is an argument, for copy and rename the
// second one.
function writesEnvByCall(command: string): boolean {
	const name = new RegExp(envName);
	for (const match of command.matchAll(nodeFileCall)) {
		if (onlyMentioned(command, match.index, match.index + match[0].length)) continue;
		const { args } = callArguments(command, match.index + match[0].length);
		const targets = /^(copy|rename)/.test(match[1] ?? '') ? args.slice(0, 2) : args.slice(0, 1);
		if (targets.some((arg) => name.test(arg))) return true;
	}
	for (const match of command.matchAll(pathCall)) {
		if (onlyMentioned(command, match.index, match.index + match[0].length)) continue;
		const { args, end } = callArguments(command, match.index + match[0].length);
		if (args.some((arg) => name.test(arg)) && pathWrite.test(command.slice(end))) return true;
	}
	return false;
}

function lastIndexBefore(text: string, needle: string, end: number): number {
	return end - needle.length < 0 ? -1 : text.lastIndexOf(needle, end - needle.length);
}

// The lexer sees no heredoc inside `"$(cat <<'EOF' …)"`. No body without a closing line, none for `<<<` or a shift.
function heredocBodies(command: string): Array<[number, number]> {
	const spans: Array<[number, number]> = [];
	for (const opener of command.matchAll(new RegExp(heredocOpener.source, 'g'))) {
		const at = opener.index;
		const inArithmetic = lastIndexBefore(command, '$((', at) > lastIndexBefore(command, '))', at);
		if (command[Math.max(at - 1, 0)] === '<' || inArithmetic) continue;
		const start = command.indexOf('\n', at + opener[0].length);
		if (start < 0) continue;
		const delimiter = (opener[4] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const close = new RegExp(`^[ \\t]*${delimiter}[ \\t]*$`, 'm').exec(command.slice(start + 1));
		if (close !== null) spans.push([start, start + 1 + close.index]);
	}
	return spans;
}

function readsEnv(command: string): boolean {
	const bodies = heredocBodies(command);
	for (const pattern of envReads) {
		for (const match of command.matchAll(pattern)) {
			const inBody = bodies.some(([begin, end]) => begin < match.index && match.index < end);
			if (inBody || onlyMentioned(command, match.index, match.index + match[0].length, false)) continue;
			return true;
		}
	}
	return false;
}

/** Returns the first verdict `command` earns, or null when nothing in it is irreversible. */
export function judgeShell(command: string): ShellVerdict | null {
	if (removesOutside(rmAbsolute, command)) return shellVerdict.rm;
	if (removesOutside(rmVariable, command)) return shellVerdict.emptyVar;
	if (anyHit(dataLoss, command)) return shellVerdict.dataLoss;
	if (anyHit(forcePush, command)) return shellVerdict.forcePush;
	if (anyHit(bypass, command)) return shellVerdict.bypass;
	if (hit(pipeToShell, command)) return shellVerdict.pipeToShell;
	if (anyHit(envWrites, command) || writesEnvByCall(command)) return shellVerdict.envWrite;
	if (readsEnv(command)) return shellVerdict.envRead;
	return null;
}
