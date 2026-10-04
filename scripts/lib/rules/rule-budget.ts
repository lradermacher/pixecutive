// rule-budget.ts — the largest set of rules that can lie in the context at once, in tokens against the real window.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules, type Rule } from './load-rules.ts';
import { patternsCanMeet } from './path-pattern.ts';

/** @aggregate The budget, its limit and the one conversion from characters to tokens are one measurement. */

/** The only place that converts characters to tokens; deliberately low, so the gate counts too many, never too few. */
export const charsPerToken = 2.5;
export const contextTokens = 1_000_000;
export const limitTokens = contextTokens / 100;

/** One set of areas a single path can load together, with the cost of everything then loaded. */
export interface RuleCombination {
	names: string[];
	chars: number;
	tokens: number;
}

function canMeet(a: Rule, b: Rule): boolean {
	return a.patterns.some((first) => b.patterns.some((second) => patternsCanMeet(first, second)));
}

// Every maximal set of areas that one path can load at once (Bron–Kerbosch); with disjoint areas each is its own set.
function areaCliques(areas: readonly Rule[]): Rule[][] {
	const cliques: Rule[][] = [];
	const expand = (chosen: Rule[], maybe: Rule[], done: Rule[]): void => {
		if (maybe.length === 0 && done.length === 0) cliques.push(chosen);
		for (const rule of [...maybe]) {
			const near = (other: Rule): boolean => other !== rule && canMeet(rule, other);
			expand([...chosen, rule], maybe.filter(near), done.filter(near));
			maybe = maybe.filter((other) => other !== rule);
			done = [...done, rule];
		}
	};
	expand([], [...areas], []);
	return cliques;
}

/** Converts characters to tokens with the one ratio above. */
export function tokens(chars: number): number {
	return Math.round(chars / charsPerToken);
}

/** Returns the always-loaded baseline (`CLAUDE.md` plus every rule without `paths:`) and every area combination. */
export function ruleBudget(root: string): { baselineChars: number; combinations: RuleCombination[]; worstTokens: number } {
	const rules = loadRules(root);
	const claude = join(root, 'CLAUDE.md');
	const baselineChars =
		(existsSync(claude) ? readFileSync(claude, 'utf8').length : 0) +
		rules.filter((rule) => rule.patterns.length === 0).reduce((sum, rule) => sum + rule.chars, 0);
	const combinations = areaCliques(rules.filter((rule) => rule.patterns.length > 0)).map((clique) => {
		const chars = baselineChars + clique.reduce((sum, rule) => sum + rule.chars, 0);
		return { names: clique.map((rule) => rule.name).sort(), chars, tokens: tokens(chars) };
	});
	const worstTokens = Math.max(tokens(baselineChars), ...combinations.map((combination) => combination.tokens));
	return { baselineChars, combinations, worstTokens };
}
