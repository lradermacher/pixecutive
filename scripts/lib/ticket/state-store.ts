// state-store.ts — the only writer of .claude/state/: every state is HMAC-signed with a key outside the repo, so a
// file written by hand counts as no state. It guards against drift, not against intent.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** @aggregate Writing, reading and locating signed state are one mechanism with one key. */

/** The kinds of state, one file each per session or card. */
export const stateKind = Object.freeze({
	ticket: 'ticket',
	unblock: 'unblock',
	push: 'push',
	agents: 'agents',
	review: 'review',
	card: 'card',
} as const);
export type StateKind = (typeof stateKind)[keyof typeof stateKind];

/** A signed state's fields; values are plain JSON. */
export type State = Record<string, unknown>;

const keyFile = join(homedir(), '.claude', 'pixecutive', 'state.key');

function canonical(state: State): string {
	const sorted = Object.keys(state)
		.filter((name) => name !== 'signature')
		.sort()
		.map((name) => [name, state[name]]);
	return JSON.stringify(Object.fromEntries(sorted));
}

function signature(state: State): string {
	if (!existsSync(keyFile)) {
		mkdirSync(dirname(keyFile), { recursive: true });
		writeFileSync(keyFile, randomBytes(32).toString('hex'), { mode: 0o600 });
		chmodSync(keyFile, 0o600);
	}
	return createHmac('sha256', readFileSync(keyFile)).update(canonical(state)).digest('hex');
}

/** Returns the path of the state of `kind` for `id` (a session ID or a card key) in the repo at `root`. */
export function statePath(root: string, kind: StateKind, id: string): string {
	return join(root, '.claude', 'state', `${kind}.${id.replace(/[^\w.-]/g, '')}.json`);
}

/** Writes `state` signed to `path`, atomically, so a reader never sees half a file. */
export function writeState(path: string, state: State): void {
	mkdirSync(dirname(path), { recursive: true });
	const signed = { ...state, signature: signature(state) };
	writeFileSync(`${path}.tmp`, `${JSON.stringify(Object.fromEntries(Object.entries(signed).sort()), null, 2)}\n`);
	renameSync(`${path}.tmp`, path);
}

/** Returns the state at `path` when it exists and its signature holds; anything else counts as no state. */
export function readState(path: string): State | null {
	try {
		const state = JSON.parse(readFileSync(path, 'utf8')) as State;
		const claimed = Buffer.from(String(state['signature'] ?? ''));
		const expected = Buffer.from(signature(state));
		return claimed.length === expected.length && timingSafeEqual(claimed, expected) ? state : null;
	} catch {
		return null;
	}
}

/** Returns the age in seconds of an ISO time stamp; an unreadable one counts as expired, never as valid. */
export function ageSeconds(stamp: unknown): number {
	const time = Date.parse(String(stamp));
	return Number.isNaN(time) ? Number.POSITIVE_INFINITY : (Date.now() - time) / 1000;
}
