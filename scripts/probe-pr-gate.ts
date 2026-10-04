// probe-pr-gate.ts — asks is-pr-create.ts whether a command creates a pull request and which head it names.
// It calls the carrier instead of rebuilding it: a probe that normalizes by itself checks its own copy.

import { isPrCreate } from './lib/shell/is-pr-create.ts';

const verb = 'pr ' + 'create';

/** Label, command, and the answer the carrier must give: `no`, or `yes <head>` with an empty head allowed. */
const cases: ReadonlyArray<readonly [string, string, string]> = [
	['at the start of the line', `gh ${verb} --base a`, 'yes '],
	['after &&', `cd /x && gh ${verb} --base a`, 'yes '],
	['after a semicolon', `cd /x ; gh ${verb} --base a`, 'yes '],
	['on line 2 after cd', `cd /path\ngh ${verb} --base a`, 'yes '],
	['gh pr view stays free', 'gh pr view 41', 'no'],
	['gh pr list stays free', 'gh pr list --state open', 'no'],
	['the words in running text stay free', 'echo we should use gh pr create', 'no'],
	['inside a quoted search pattern stays free', `grep -nE 'git push|gh ${verb}|x' docs/a.md`, 'no'],
	['behind a real pipe', `true | gh ${verb} --base a`, 'yes '],
	['with an environment variable before it', `SKIP_GATE=1 gh ${verb} --base a`, 'yes '],
	['on the line after a comment', `cd /x # note\ngh ${verb} --base a`, 'yes '],

	['--head with a blank', `gh ${verb} --base a --head feat/x`, 'yes feat/x'],
	['--head with an equals sign', `gh ${verb} --head=feat/y --base a`, 'yes feat/y'],
	['without --head stays empty', `gh ${verb} --base a --title t`, 'yes '],
	['--head without a value stays empty', `gh ${verb} --head --base a`, 'yes '],
	[
		'--head in the text AFTER it does not count',
		`gh ${verb} --head feat/real --body 'see --head feat/fake'`,
		'yes feat/real',
	],
	[
		'--head in the text BEFORE it does not count',
		`gh ${verb} --body 'see --head feat/fake' --head feat/real`,
		'yes feat/real',
	],
];

let failed = 0;
console.log('Probe: does the PR gate recognize the command and the head branch?');
for (const [label, command, expected] of cases) {
	const answer = isPrCreate(command);
	const got = answer.creates ? `yes ${answer.head}` : 'no';
	const ok = got === expected;
	if (!ok) failed += 1;
	console.log(`  ${ok ? '✅' : '⛔'} ${label.padEnd(50)} »${got}«${ok ? '' : `, expected »${expected}«`}`);
}
console.log('');
if (failed > 0) {
	console.log(`⛔ ${failed} of ${cases.length} cases do NOT show the expected result.`);
	process.exit(1);
}
console.log(`✅ ${cases.length} cases, each with the expected result.`);
