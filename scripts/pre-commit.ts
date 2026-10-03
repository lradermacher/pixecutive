// pre-commit.ts — rejects a commit that leaks or fails: forbidden paths, a host-derived identity, a wrong branch name,
// secrets, local paths, denylisted strings, and every gate in .claude/data/precommit-checks.tsv. Checked is a copy of
// exactly the staged state, so unstaged edits can neither hide nor cause a finding.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBranchName } from './lib/guard/check-branch-name.ts';
import { checkIdentity } from './lib/guard/check-identity.ts';
import { forbiddenPaths } from './lib/guard/forbidden-paths.ts';
import { readLocalConfig } from './lib/guard/read-local-config.ts';
import { scanText, type ScanLine } from './lib/guard/scan-text.ts';
import { secretPatterns } from './lib/guard/secret-patterns.ts';

function git(args: readonly string[], cwd?: string): string {
	return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	});
}

function lines(text: string): string[] {
	return text.split('\n').filter(Boolean);
}

const root = git(['rev-parse', '--show-toplevel']).trim();
const stagedAll = lines(git(['diff', '--cached', '--name-only', '--no-renames']));
if (stagedAll.length === 0) process.exit(0);
const staged = lines(git(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACM']));
const tree = git(['write-tree']).trim();
// The copy is built from HEAD and the staged tree; inherited index and directory variables would write into the repo.
delete process.env['GIT_INDEX_FILE'];
delete process.env['GIT_DIR'];
delete process.env['GIT_WORK_TREE'];

const failures: string[] = [];
const report = (title: string, findings: readonly string[]): void => {
	if (findings.length === 0) return;
	failures.push(title, ...findings.map((finding) => `  ⛔ ${finding}`));
};

const config = readLocalConfig(root);
report('The local config cannot be read, so the denylist would not run:', config.problems);
report('Forbidden paths in the commit:', forbiddenPaths(stagedAll));
report('Commit identity:', checkIdentity(config.authors));
let branch = '';
try {
	branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']).trim();
} catch {
	report('Branch:', ['no branch (detached HEAD) — create one: git switch -c feat/pix-NNN-short']);
}
const branchFinding = branch === '' ? null : checkBranchName(branch);
report('Branch:', branchFinding === null ? [] : [branchFinding]);

const copy = realpathSync(mkdtempSync(join(tmpdir(), 'pre-commit-tree.')));
const removeCopy = (): void => {
	spawnSync('git', ['-C', root, 'worktree', 'remove', '--force', copy], { stdio: 'ignore' });
	rmSync(copy, { recursive: true, force: true });
};
try {
	let base: string;
	try {
		base = git(['rev-parse', '--verify', '-q', 'HEAD']).trim();
	} catch {
		base = git(['commit-tree', '-m', 'pre-commit', git(['mktree'], root).trim()]).trim();
	}
	git(['-C', root, 'worktree', 'add', '-q', '--detach', '--no-checkout', copy, base]);
	git(['-C', copy, 'read-tree', '-u', '--reset', tree]);
	if (existsSync(join(root, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(copy, 'node_modules'));

	const scanLines: ScanLine[] = [];
	for (const path of staged) {
		const file = join(copy, path);
		if (secretPatterns.skip.test(path) || !existsSync(file) || !statSync(file).isFile()) continue;
		const content = readFileSync(file);
		if (content.includes(0)) continue;
		content
			.toString('utf8')
			.split('\n')
			.forEach((text, index) => scanLines.push({ location: `${path}:${index + 1}`, text }));
	}
	report('Not allowed in the history:', scanText(scanLines, config));
	if (!config.found) console.log(`  ℹ️  No denylist in ${config.path}: only secrets and local paths are checked.`);

	const checksFile = join(copy, '.claude/data/precommit-checks.tsv');
	if (!existsSync(checksFile)) {
		report('Gate table:', ['.claude/data/precommit-checks.tsv is missing — without it no gate and no probe runs']);
	} else {
		const table = readFileSync(checksFile, 'utf8');
		const rows = (table.split(/^---$/m)[2] ?? table).split('\n').filter((row) => row.trim() !== '' && !row.startsWith('#'));
		for (const row of rows) {
			const [trigger = '', command = ''] = row.split('\t');
			const pattern = new RegExp(trigger, 'i');
			if (command === '' || !stagedAll.some((path) => pattern.test(path))) continue;
			const run = spawnSync('bash', ['-c', command], { cwd: copy, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: copy } });
			if (run.status !== 0) {
				const output = `${run.stdout}${run.stderr}`.split('\n');
				const marked = output.filter((line) => line.includes('⛔'));
				report(`Gate failed: ${command}`, (marked.length > 0 ? marked : output.slice(-3)).map((line) => line.replace(/^\s*⛔\s*/, '')));
			}
		}
		const registered = readdirSync(join(copy, 'scripts'))
			.filter((name) => /^probe-.*\.(sh|ts)$/.test(name))
			.filter((name) => !table.includes(`scripts/${name}`))
			.map((name) => `scripts/${name} has no row in .claude/data/precommit-checks.tsv — it would never run`);
		report('Unregistered probes:', registered);
	}
} finally {
	removeCopy();
}

if (failures.length > 0) {
	console.log(failures.join('\n'));
	console.log('\nCommit stopped.');
	process.exit(1);
}
