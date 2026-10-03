// pre-push.ts — rejects a push whose commits carry anything the history guard forbids, or whose stage 2 is red. A
// pushed branch is public the moment it arrives, merged or not; scanned is every added line of every pushed commit.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { forbiddenPaths } from './lib/guard/forbidden-paths.ts';
import { readLocalConfig } from './lib/guard/read-local-config.ts';
import { scanText, type ScanLine } from './lib/guard/scan-text.ts';
import { secretPatterns } from './lib/guard/secret-patterns.ts';

const zero = /^0+$/;

function git(args: readonly string[]): string {
	return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: 1024 * 1024 * 1024,
		stdio: ['ignore', 'pipe', 'ignore'],
	});
}

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const config = readLocalConfig(root);
if (config.problems.length > 0) {
	console.error('⛔ The local config cannot be read, so the denylist would not run:');
	for (const problem of config.problems) console.error(`  ⛔ ${problem}`);
	process.exit(1);
}

let failed = false;
let carriesCommits = false;
// Git passes `<local ref> <local sha> <remote ref> <remote sha>` per ref on stdin.
for (const row of readFileSync(0, 'utf8').split('\n')) {
	const [localRef = '', localSha = '', remoteRef = '', remoteSha = ''] = row.trim().split(/\s+/);
	if (localSha === '' || zero.test(localSha)) continue;
	const range = remoteSha === '' || zero.test(remoteSha) ? [localSha, '--not', '--remotes'] : [`${remoteSha}..${localSha}`];
	if (git(['rev-list', '-1', ...range]).trim() !== '') carriesCommits = true;

	const lines: ScanLine[] = [];
	let commit = '';
	let file = '';
	for (const line of git(['log', '-p', '--no-color', '--no-ext-diff', '--format=commit %h', ...range]).split('\n')) {
		if (line.startsWith('commit ')) commit = line.slice(7);
		else if (line.startsWith('+++ ')) file = line.slice(6);
		else if (line.startsWith('+') && !secretPatterns.skip.test(file)) lines.push({ location: `${commit} ${file}`, text: line.slice(1) });
	}
	const paths = [...new Set(git(['log', '--format=', '--name-only', ...range]).split('\n').filter(Boolean))];
	const findings = [...scanText(lines, config), ...forbiddenPaths(paths)];
	if (findings.length > 0) {
		console.error(`⛔ ${localRef.replace('refs/heads/', '')} → ${remoteRef.replace('refs/heads/', '')}: not allowed in the history`);
		for (const finding of findings) console.error(`  ⛔ ${finding}`);
		failed = true;
	}
}

// Stage 2 runs only when the push carries new commits; a pure deletion carries no code out.
if (!failed && carriesCommits) {
	const verify = join(root, 'scripts/verify-full.ts');
	if (!existsSync(verify)) {
		console.error('⛔ scripts/verify-full.ts is missing — stage 2 cannot run.');
		failed = true;
	} else if (spawnSync('node', [verify], { cwd: root, stdio: ['ignore', 2, 2] }).status !== 0) {
		console.error('⛔ Stage 2 is red (scripts/verify-full.ts) — push rejected.');
		failed = true;
	}
}
process.exit(failed ? 1 : 0);
