// card-verdict.ts — the one answer to "may this card move on": entry (before In Progress) and exit (before Done).
// open, close, boxes and both transition hooks ask here; a second copy of this logic would answer differently.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules } from '../rules/load-rules.ts';
import { isCardKey } from './card-key.ts';
import { readState, stateKind, statePath, type State } from './state-store.ts';
import { ticketTypes } from './ticket-types.ts';

/** @aggregate The stages and the verdict over them are one decision. */

/** The stages a card is judged at; entry checks key and plan, exit also coverage, boxes and planned mechanisms. */
export const verdictStage = Object.freeze({ entry: 'entry', exit: 'exit' } as const);
export type VerdictStage = (typeof verdictStage)[keyof typeof verdictStage];

const boxAny = /^\s*[-*+]\s+\[[ xX]\]/;
const boxOpen = /^\s*[-*+]\s+\[ \]/;

function plansFor(root: string, ticket: string): string[] {
	const dir = join(root, 'docs', 'plans', 'impl');
	if (!isCardKey(ticket) || !existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.startsWith(`PLAN_${ticket}_`) && name.endsWith('.md'))
		.map((name) => `docs/plans/impl/${name}`);
}

// The card's type and acceptance count come from this session's state; at the exit also from the closing record,
// which a confirmed close leaves behind. Another session's state never counts: then file order would decide.
function cardSource(root: string, ticket: string, session: string, stage: VerdictStage): State | null {
	const own = session === '' ? null : readState(statePath(root, stateKind.ticket, session));
	if (own?.['ticket'] === ticket) return own;
	if (stage !== verdictStage.exit) return null;
	const record = readState(statePath(root, stateKind.card, ticket));
	return record?.['ticket'] === ticket ? record : null;
}

/**
 * Judges `ticket` at `stage`. Each step makes the next unmeasurable when it fails: a real card key, exactly one plan
 * (none only for plan-free types), the card's acceptance count known and covered, at least one box, no open box, no
 * rule naming the card as the owner of a planned mechanism. Unknown always falls to the strict side.
 */
export function cardVerdict(input: {
	root: string;
	ticket: string;
	stage: VerdictStage;
	session: string;
	type?: string;
}): { ok: boolean; lines: string[] } {
	const { root, ticket, stage, session } = input;
	const label = stage === verdictStage.entry ? 'No move to In Progress' : 'No move to Done';
	const no = (...lines: string[]): { ok: false; lines: string[] } => ({ ok: false, lines });
	if (!isCardKey(ticket)) {
		return no(`⛔ '${ticket}' is no card key. Expected exactly PIX-<digits>: no numeric issue ID, no glob, no space.`);
	}
	const source = cardSource(root, ticket, session, stage);
	const type = input.type ?? (typeof source?.['type'] === 'string' ? source['type'] : undefined);
	const plans = plansFor(root, ticket);
	if (plans.length > 1) {
		return no(`⛔ ${label}: ${ticket} has ${plans.length} implementation plans; which one carries the card is undecidable.`, ...plans.map((plan) => `   ${plan}`));
	}
	const plan = plans[0];
	if (plan === undefined) {
		if (type !== undefined && ticketTypes(root).get(type) === false) return { ok: true, lines: [`✅ ${ticket} is type ${type} and plan-free`] };
		return no(
			type === undefined
				? `⛔ ${label}: ${ticket} has no implementation plan, and its type is unknown in this session, so it needs one.`
				: `⛔ ${label}: ${ticket} is type ${type} and needs an implementation plan; there is none.`,
			`   Expected: docs/plans/impl/PLAN_${ticket}_<short>.md`,
		);
	}
	if (stage === verdictStage.entry) return { ok: true, lines: [`✅ ${ticket}: implementation plan ${plan}`] };

	const text = readFileSync(join(root, plan), 'utf8').split('\n');
	const acceptance = Number(source?.['acceptanceLines']);
	if (source === null || !Number.isInteger(acceptance)) {
		return no(
			`⛔ ${label}: no work package and no closing record for ${ticket}, so its number of acceptance lines is unknown.`,
			`   node scripts/ticket.ts open ${ticket} --type <type> --title "<title>" --acceptance <N>`,
		);
	}
	const boxes = text.filter((line) => boxAny.test(line)).length;
	if (acceptance > 0 && boxes < acceptance) {
		return no(`⛔ ${label}: ${plan} carries ${boxes} acceptance lines, the card ${ticket} has ${acceptance}; lines are missing.`);
	}
	if (boxes === 0) return no(`⛔ ${label}: ${plan} carries no acceptance line. No box is not "all ticked", it is "nothing measured".`);
	const open = text.flatMap((line, index) => (boxOpen.test(line) ? [`   ${index + 1}: ${line.trim()}`] : []));
	if (open.length > 0) return no(`⛔ ${label}: ${ticket} has open boxes in ${plan}`, ...open);
	// A promise may stand anywhere in a bracket, `[Lint x · Planned PIX-N: y]`, in a rule or in an ADR.
	const promise = new RegExp(`\`\\[[^\\]\`]*Planned ${ticket}:`);
	const recordDir = join(root, 'docs', 'ADR');
	const carriers = [
		...loadRules(root).map((rule) => ({ path: rule.path, text: rule.body })),
		...(existsSync(recordDir) ? readdirSync(recordDir) : [])
			.filter((name) => /^\d{4}-.*\.md$/.test(name))
			.map((name) => ({ path: `docs/ADR/${name}`, text: readFileSync(join(recordDir, name), 'utf8') })),
	];
	const planned = carriers.flatMap((carrier) => (promise.test(carrier.text) ? [`   ${carrier.path} still names a mechanism planned for ${ticket}`] : []));
	if (planned.length > 0) return no(`⛔ ${label}: ${ticket} promised mechanisms that are still listed as planned`, ...planned);
	return { ok: true, lines: [`✅ ${ticket}: all ${boxes} boxes ticked (${plan})`] };
}
