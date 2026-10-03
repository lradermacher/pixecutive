// verify-full.ts — stage 2, the full gate before every push and pull request: the package scripts and every gate over
// the whole repo, without path heuristics, so it catches what a change breaks elsewhere. Exit 0 is green, 1 red.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const gitDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
const greenMark = join(gitDir, 'verify-full-green');

// A green run holds for its tree; with unsaved changes no tree describes the state, and it always runs.
function cleanTree(): string {
	const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
	return status === '' ? execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim() : '';
}

const tree = cleanTree();
if (tree !== '' && !process.env['VERIFY_FULL_AGAIN'] && existsSync(greenMark) && readFileSync(greenMark, 'utf8').trim() === tree) {
	console.log(`✅ STAGE 2 GREEN — this tree was already checked green (${tree.slice(0, 12)}); again with VERIFY_FULL_AGAIN=1`);
	process.exit(0);
}

// Lint, format and tests arrive with the first workspace package; from then on a missing script is red, never skipped.
const hasPackage = ['apps', 'packages'].some(
	(dir) => existsSync(join(root, dir)) && readdirSync(join(root, dir)).some((name) => existsSync(join(root, dir, name, 'package.json'))),
);
const required = hasPackage ? ['lint', 'format:check', 'typecheck', 'test'] : ['typecheck'];
const scripts = existsSync(join(root, 'package.json'))
	? ((JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {})
	: {};

let failed = false;
const step = (label: string, command: string, args: readonly string[]): void => {
	console.log(`\n== ${label} ==`);
	if (spawnSync(command, args, { cwd: root, stdio: 'inherit' }).status !== 0) {
		console.log(`❌ ${label}`);
		failed = true;
	}
};
for (const script of required) {
	if (scripts[script] === undefined) {
		console.log(`\n== ${script} ==\n❌ package.json has no '${script}' script`);
		failed = true;
	} else {
		step(script, 'npm', ['run', '--silent', script]);
	}
}
// Every scripts/check-*.ts is a gate, so a new gate joins stage 2 without being registered here.
const gates = existsSync(join(root, 'scripts')) ? readdirSync(join(root, 'scripts')).filter((name) => /^check-.*\.ts$/.test(name)) : [];
for (const gate of gates) step(gate, 'node', [join('scripts', gate), '--all']);

if (failed) {
	console.log('\n❌ STAGE 2 RED');
	process.exit(1);
}
// Recorded only when the tree stayed the same during the run.
if (tree !== '' && cleanTree() === tree) writeFileSync(greenMark, `${tree}\n`);
console.log('\n✅ STAGE 2 GREEN');
