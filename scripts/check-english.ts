// check-english.ts — rejects any word in a file or file name that is neither English nor an allowed technical term.
// Usage: node scripts/check-english.ts [--staged | <path>…]; without arguments every file in the repo is checked.

import { spawnSync } from 'node:child_process';
import { filesToCheck } from './lib/files-to-check.ts';

const cspell = 'node_modules/.bin/cspell';
const files = filesToCheck(process.argv.slice(2));
if (files.length === 0) {
	console.log('✅ check-english: nothing to check');
	process.exit(0);
}

const contents = spawnSync(cspell, ['--no-progress', '--no-summary', '--no-color', '--file-list', 'stdin'], {
	input: files.join('\n'),
	encoding: 'utf8',
});
// File names are checked as text: CSpell has no option for them, and a German file name is as public as German code.
const names = spawnSync(cspell, ['--no-progress', '--no-summary', '--no-color', 'stdin://file-names.txt'], {
	input: files.join('\n'),
	encoding: 'utf8',
});
if (contents.error !== undefined || names.error !== undefined) {
	console.log(`⛔ check-english: CSpell could not run (${cspell}); install the workspace with pnpm install`);
	process.exit(1);
}

const findings = [
	...contents.stdout.split('\n').filter(Boolean),
	...names.stdout.split('\n').filter(Boolean).map((line) => line.replace(/^file-names\.txt:\d+:\d+/, 'file name')),
];
if (findings.length > 0) {
	for (const line of findings) console.log(`⛔ ${line}`);
	console.log('   Write it in English, or add a real technical term to .cspell/project-words.txt.');
	process.exit(1);
}
console.log(`✅ check-english: ${files.length} files in English`);
