// ticket.ts — the work package of this session: exactly one open card, without which no write lands on a protected
// path, plus the maintainer's push and unblock windows and review records. Every state goes
// through state-store.ts. Usage: node scripts/ticket.ts without arguments lists the subcommands.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { isCardKey } from './lib/ticket/card-key.ts';
import { cardVerdict, verdictStage } from './lib/ticket/card-verdict.ts';
import { ageSeconds, readState, stateKind, statePath, writeState } from './lib/ticket/state-store.ts';
import { ticketTypes } from './lib/ticket/ticket-types.ts';

const packageHours = 8;
const unblockMinutes = 45;
const pushMinutes = 30;
const sweepHours = 24;
const maxReviews = 2;

function git(args: readonly string[]): string {
	try {
		return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return '';
	}
}

const root = process.env['CLAUDE_PROJECT_DIR'] || execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const [command = '', ...rest] = process.argv.slice(2);

function option(name: string): string | undefined {
	const index = rest.indexOf(name);
	return index === -1 ? undefined : rest[index + 1];
}

function positional(): string | undefined {
	return rest.find((arg, index) => !arg.startsWith('--') && !(rest[index - 1] ?? '').startsWith('--'));
}

const session = option('--session') || process.env['CLAUDE_CODE_SESSION_ID'] || '';
const now = (): string => new Date().toISOString();
const say = (...lines: string[]): void => console.log(lines.join('\n'));
const fail = (...lines: string[]): never => {
	console.error(lines.join('\n'));
	process.exit(1);
};

function packageState(id: string = session): Record<string, unknown> | null {
	return id === '' ? null : readState(statePath(root, stateKind.ticket, id));
}

function open(): void {
	const ticket = positional() ?? '';
	const type = option('--type') ?? '';
	const title = option('--title') ?? '';
	const acceptanceText = option('--acceptance') ?? '';
	if (!isCardKey(ticket)) fail(`⛔ Card key missing or malformed: '${ticket}'`, '   node scripts/ticket.ts open PIX-42 --type feature --title "…" --acceptance 5');
	if (type === '' || title === '') fail('⛔ --type and --title are required: the session reads the card first, this script never asks Jira.');
	const types = ticketTypes(root);
	if (!types.has(type)) fail(`⛔ Unknown type '${type}'. Allowed: ${[...types.keys()].join(' ')} (.claude/data/ticket-types.tsv)`);
	if (session === '') fail('⛔ CLAUDE_CODE_SESSION_ID is empty: this runs outside a session.');
	const entry = cardVerdict({ root, ticket, stage: verdictStage.entry, session, type });
	if (!entry.ok) fail(...entry.lines, '', '   No build without a plan.');
	const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
	if (branch === '' || branch === 'main' || branch === 'master') fail(`⛔ No work on '${branch || 'a detached HEAD'}'. git switch -c feat/${ticket.toLowerCase()}-short`);
	const branchTicket = /pix-[0-9]+/i.exec(branch)?.[0].toUpperCase();
	if (branchTicket !== ticket) fail(`⛔ Branch '${branch}' carries ${branchTicket ?? 'no card'}, the package would be ${ticket}.`);
	const current = packageState();
	if (current && current['ticket'] !== ticket) {
		fail(`⛔ This session works on ${String(current['ticket'])}; ${ticket} opens once it is closed.`, '   node scripts/ticket.ts close, then open on its branch.');
	}
	if (acceptanceText !== '' && !/^[0-9]+$/.test(acceptanceText)) fail(`⛔ --acceptance '${acceptanceText}' is no number.`);
	let acceptance = Number(acceptanceText || 0);
	if (types.get(type) && acceptance < 1) {
		fail(`⛔ --acceptance is required for type ${type}: the number of acceptance lines of the card ${ticket}.`, '   Without it the exit cannot notice that the plan lost lines of the card.');
	}
	// Opening the same card again may raise the count, never lower it: otherwise --acceptance 1 were the way out.
	const before = current?.['ticket'] === ticket ? Number(current['acceptanceLines'] ?? 0) : 0;
	if (before > acceptance) {
		say(`⚠️  --acceptance ${acceptance} is below the ${before} already set; it stays ${before}.`);
		acceptance = before;
	}
	writeState(statePath(root, stateKind.ticket, session), {
		session,
		ticket,
		type,
		title,
		branch,
		plan: cardVerdict({ root, ticket, stage: verdictStage.entry, session, type }).lines[0]?.split(' plan ')[1] ?? '',
		acceptanceLines: acceptance,
		openedAt: now(),
	});
	rmSync(statePath(root, stateKind.card, ticket), { force: true });
	say(`✅ Work package set: ${ticket} (${type}) — ${title}`, `   Branch ${branch} · valid ${packageHours} h`);
}

function reviewLine(ticket: string): string {
	const tally = join(root, '.claude', 'state', `reviews.${ticket}.count`);
	const runs = existsSync(tally) ? readFileSync(tally, 'utf8').trim() : '0';
	const dir = join(root, '.claude', 'state');
	const records = existsSync(dir) ? readdirSync(dir).filter((name) => /^review\..+\.json$/.test(name)) : [];
	const best = records
		.map((name) => readState(join(dir, name)))
		.filter((state) => state?.['ticket'] === ticket && isAncestor(String(state['sha'])))
		.sort((a, b) => String(b?.['checkedAt']).localeCompare(String(a?.['checkedAt'])))[0];
	if (!best) return `  Review: ${runs} run(s), no record on this branch. First run: the whole diff against the card's base.`;
	const sha = String(best['sha']).slice(0, 12);
	return `  Review: ${runs} run(s), last record ${sha} (${String(best['findings'])} finding(s)). Next run: git diff ${sha}..HEAD`;
}

function isAncestor(sha: string): boolean {
	try {
		execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', sha, 'HEAD'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function show(): void {
	const id = positional() ?? session;
	const state = packageState(id);
	if (!state) {
		const forged = id !== '' && existsSync(statePath(root, stateKind.ticket, id));
		say(forged ? '⛔ A state exists, but its signature does not hold; it does not count.' : 'no work package set');
		return;
	}
	say(`${String(state['ticket'])} (${String(state['type'])}) — ${String(state['title'])}`, `  Branch ${String(state['branch'])} · opened ${String(state['openedAt'])}`, reviewLine(String(state['ticket'])));
}

function close(): void {
	const force = rest.includes('--force');
	const id = positional() ?? session;
	const path = statePath(root, stateKind.ticket, id);
	if (id === '' || !existsSync(path)) {
		say('no work package set — nothing to close.');
		return;
	}
	const state = readState(path);
	// A broken signature is no shortcut, not even with --force: forging the state must not be the faster way.
	if (!state) fail(`⛔ The state of this session carries no valid signature; it is no work package and is not closed: ${relative(root, path)}`);
	const ticket = String(state?.['ticket'] ?? '');
	if (!force) {
		const verdict = cardVerdict({ root, ticket, stage: verdictStage.exit, session: id });
		if (!verdict.ok) fail(...verdict.lines, '', '   A line left open on purpose: node scripts/ticket.ts close --force, and the reason goes into the card.');
		writeState(statePath(root, stateKind.card, ticket), { ticket, type: state?.['type'], acceptanceLines: state?.['acceptanceLines'], closedAt: now() });
	} else {
		rmSync(statePath(root, stateKind.card, ticket), { force: true });
	}
	rmSync(path, { force: true });
	rmSync(statePath(root, stateKind.unblock, id), { force: true });
	say(force ? '⚠️  Work package closed with --force. The CARD is not accepted: its open lines belong into the card.' : 'Work package closed.');
}

function judge(stage: typeof verdictStage.entry | typeof verdictStage.exit): void {
	const ticket = positional() ?? String(packageState()?.['ticket'] ?? '');
	if (ticket === '') fail('ticket.ts: no card key.');
	const verdict = cardVerdict({ root, ticket, stage, session });
	say(...verdict.lines);
	process.exit(verdict.ok ? 0 : 1);
}

function window(kind: typeof stateKind.unblock | typeof stateKind.push): void {
	if (session === '') fail('⛔ No session ID.');
	const minutes = Number(option('--minutes') ?? (kind === stateKind.unblock ? unblockMinutes : pushMinutes));
	const reason = option('--reason') ?? '';
	if (kind === stateKind.unblock && reason.trim() === '') fail('⛔ /unblock needs a reason; it is reported with every write.');
	writeState(statePath(root, kind, session), { session, minutes, reason, openedAt: now() });
	say(kind === stateKind.unblock ? `🔓 Unblocked for ${minutes} minutes — reason: ${reason}` : `🚀 Push window open for ${minutes} minutes.`);
}

function windowOpen(kind: typeof stateKind.unblock | typeof stateKind.push, id: string): Record<string, unknown> | null {
	const state = id === '' ? null : readState(statePath(root, kind, id));
	return state && ageSeconds(state['openedAt']) < Number(state['minutes']) * 60 ? state : null;
}

function reviewDone(): void {
	if (session === '') fail('⛔ No session ID.');
	const sha = option('--sha') ?? git(['rev-parse', 'HEAD']);
	if (sha === '') fail('⛔ No HEAD to record.');
	const card = String(packageState()?.['ticket'] ?? `session-${session}`);
	const tally = join(root, '.claude', 'state', `reviews.${card}.count`);
	const count = Number(existsSync(tally) ? readFileSync(tally, 'utf8').trim() : 0) + 1;
	// A third review rarely finds a blocker but costs a full pass; it runs only with the maintainer's yes.
	if (count > maxReviews && process.env['PIX_REVIEW_AGAIN'] !== '1') {
		fail(`⛔ Review number ${count} on ${card} — only with the maintainer's yes: PIX_REVIEW_AGAIN=1 in front.`);
	}
	writeState(statePath(root, stateKind.review, session), { session, ticket: card, sha, findings: Number(option('--findings') ?? 0), checkedAt: now() });
	writeFileSync(tally, `${count}\n`);
	say(`✅ Review recorded for ${sha.slice(0, 12)} (${option('--findings') ?? 0} finding(s)).`);
}

function reviewOk(): void {
	const at = option('--at');
	const state = readState(statePath(root, stateKind.review, positional() ?? session));
	const target = git(['rev-parse', at ?? 'HEAD']);
	process.exit(state && target !== '' && state['sha'] === target ? 0 : 1);
}

function isProtected(path: string): boolean {
	const file = join(root, '.claude', 'data', 'protected-paths.txt');
	if (!existsSync(file)) return true;
	const lines = readFileSync(file, 'utf8').split('\n').map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('#'));
	const matches = (pattern: string): boolean =>
		new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(path);
	if (lines.some((line) => line.startsWith('!') && matches(line.slice(1)))) return false;
	return lines.some((line) => !line.startsWith('!') && matches(line));
}

function check(): void {
	const target = option('--path') ?? '';
	if (target === '') process.exit(0);
	const path = isAbsolute(target) ? relative(root, target) : target.replace(/^\.\//, '');
	if (path.startsWith('..') || isAbsolute(path) || !isProtected(path)) process.exit(0);
	const unblocked = windowOpen(stateKind.unblock, session);
	if (unblocked) {
		say(`unblocked: ${String(unblocked['reason'])}`);
		process.exit(0);
	}
	const state = packageState();
	if (!state) {
		const forged = session !== '' && existsSync(statePath(root, stateKind.ticket, session));
		say(
			forged ? '⛔ The state in .claude/state/ carries no valid signature; it was not written by ticket.ts and does not count.' : '⛔ No work package set — this write is rejected.',
			`   File: ${path}`,
			'   Way:  /code PIX-N reads the card, checks the plan and sets the package;',
			'         the maintainer types /unblock <reason> for a 45-minute window.',
			'   Free without a package: docs/, the README and *.spec.ts or *.test.ts files.',
		);
		process.exit(1);
	}
	const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
	if (state['branch'] !== branch) say(`⛔ The work package ${String(state['ticket'])} was set on '${String(state['branch'])}', this is '${branch}'.`);
	else if (ageSeconds(state['openedAt']) >= packageHours * 3600) say(`⛔ The work package ${String(state['ticket'])} is older than ${packageHours} h and expired. Set it again: /code ${String(state['ticket'])}`);
	else process.exit(0);
	process.exit(1);
}

function sweep(): void {
	const dir = join(root, '.claude', 'state');
	if (!existsSync(dir)) return;
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		const state = name.endsWith('.json') ? readState(path) : null;
		const stale = statSync(path).mtimeMs < Date.now() - sweepHours * 3600 * 1000;
		if (/^(ticket|unblock|push)\./.test(name) && (state === null ? stale : ageSeconds(state['openedAt']) >= sweepHours * 3600)) rmSync(path, { force: true });
		// A file of a kind nothing writes any more is read by nothing; the review tally is the one file beside the store.
		if (![...Object.values(stateKind), 'reviews'].some((kind) => name.startsWith(`${kind}.`)) && stale) rmSync(path, { force: true });
		// A review record holds across sessions until its commit lies on no branch any more.
		if (/^review\./.test(name) && (state === null || git(['branch', '--contains', String(state['sha'])]) === '')) rmSync(path, { force: true });
	}
	for (const name of readdirSync(dir).filter((entry) => /^reviews\..+\.count$/.test(entry))) {
		const card = name.slice('reviews.'.length, -'.count'.length);
		const kept = readdirSync(dir).some((entry) => entry.startsWith('review.') && readState(join(dir, entry))?.['ticket'] === card);
		if (!kept) rmSync(join(dir, name), { force: true });
	}
}

switch (command) {
	case 'open':
		open();
		break;
	case 'show':
		show();
		break;
	case 'close':
		close();
		break;
	case 'boxes':
		judge(verdictStage.exit);
		break;
	case 'plan-required':
		judge(verdictStage.entry);
		break;
	case 'unblock':
		window(stateKind.unblock);
		break;
	case 'push-ok':
		window(stateKind.push);
		break;
	case 'push-allowed':
		process.exit(windowOpen(stateKind.push, positional() ?? session) ? 0 : 1);
		break;
	case 'review-done':
		reviewDone();
		break;
	case 'review-ok':
		reviewOk();
		break;
	case 'check':
		check();
		break;
	case 'sweep':
		sweep();
		break;
	default:
		say(
			'ticket.ts — the work package of this session',
			'  open PIX-N --type <type> --title "<title>" --acceptance <N>   (N = acceptance lines of the CARD)',
			'  show · close [--force] · boxes [PIX-N] · plan-required PIX-N',
			'  review-done [--sha X] [--findings N] · review-ok [--at <ref>] [<session>]',
			'  push-allowed [<session>] · check --path <file> · sweep',
			'  unblock, push-ok: called by hooks only',
		);
		process.exit(1);
}
