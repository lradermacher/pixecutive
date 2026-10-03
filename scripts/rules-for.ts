// rules-for.ts — which rules lie in the context for a file, and what the rules cost in tokens.
// Usage: node scripts/rules-for.ts <path> | --budget | --probe; exit 1 above the limit or on a failed load probe.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules } from './lib/rules/load-rules.ts';
import { limitTokens, ruleBudget, tokens } from './lib/rules/rule-budget.ts';
import { rulesForPath } from './lib/rules/rules-for-path.ts';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const claudeChars = existsSync(join(root, 'CLAUDE.md')) ? readFileSync(join(root, 'CLAUDE.md'), 'utf8').length : 0;

function show(path: string): number {
	const rules = rulesForPath(path, root);
	const total = tokens(claudeChars + rules.reduce((sum, rule) => sum + rule.chars, 0));
	console.log(`Path: ${path}`);
	console.log(`  ${String(tokens(claudeChars)).padStart(5)}  CLAUDE.md`);
	for (const rule of rules) console.log(`  ${String(tokens(rule.chars)).padStart(5)}  ${rule.path}`);
	console.log(`  total ${total} / ${limitTokens} tokens ${total <= limitTokens ? '[OK]' : '[ABOVE THE LIMIT]'}`);
	return total <= limitTokens ? 0 : 1;
}

function budget(): number {
	const { baselineChars, combinations, worstTokens } = ruleBudget(root);
	console.log(`Baseline (CLAUDE.md and every rule without paths:): ${tokens(baselineChars)} tokens\n`);
	for (const combination of combinations) {
		const flag = combination.tokens > limitTokens ? '  <== ABOVE THE LIMIT' : '';
		console.log(`${combination.names.join(' + ').padEnd(34)}${String(combination.tokens).padStart(8)}${flag}`);
	}
	const verdict = worstTokens <= limitTokens ? '✅' : '⛔';
	console.log(`\n${verdict} Worst case loaded at once: ${worstTokens} tokens (limit ${limitTokens})`);
	return worstTokens <= limitTokens ? 0 : 1;
}

// Real paths of this repo, including the trap: a directory of one area deep inside another area.
function probe(): number {
	const cases: Array<[string, string, boolean]> = [
		['packages/core/src/domain/office.ts', 'core', true],
		['apps/server/src/main.ts', 'core', true],
		['apps/web/src/app.tsx', 'core', false],
		['scripts/check-rules.ts', 'ops', true],
		['.claude/hooks/rule-context.ts', 'ops', true],
		['packages/core/scripts/seed.ts', 'ops', false],
		['package.json', 'ops', true],
		['packages/core/package.json', 'ops', false],
		['/tmp/outside.ts', 'core', false],
	];
	let failed = 0;
	for (const [path, rule, want] of cases) {
		const got = rulesForPath(path, root).some((loaded) => loaded.name === rule);
		if (got !== want) failed += 1;
		console.log(`${got === want ? '✅' : '⛔'} ${path.padEnd(40)} ${got ? 'loads' : 'does not load'} ${rule}`);
	}
	const always = loadRules(root).filter((rule) => rule.patterns.length === 0).map((rule) => rule.name);
	for (const name of ['basis', 'workflow']) {
		if (!always.includes(name)) failed += 1;
		console.log(`${always.includes(name) ? '✅' : '⛔'} ${name} has no paths: and is always loaded`);
	}
	for (const path of ['packages/core/scripts/seed.ts', 'apps/server/src/main.ts', 'scripts/lib/rules/load-rules.ts']) {
		const loaded = rulesForPath(path, root);
		const total = tokens(claudeChars + loaded.reduce((sum, rule) => sum + rule.chars, 0));
		if (total > limitTokens) failed += 1;
		console.log(`${total <= limitTokens ? '✅' : '⛔'} ${path.padEnd(40)} ${total}/${limitTokens} tokens`);
	}
	return failed === 0 ? 0 : 1;
}

const argument = process.argv[2];
if (argument === undefined || argument === '--help') {
	console.log('node scripts/rules-for.ts <path> | --budget | --probe');
	process.exit(1);
}
process.exit(argument === '--budget' ? budget() : argument === '--probe' ? probe() : show(argument));
