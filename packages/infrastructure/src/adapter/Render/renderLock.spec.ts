import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { RenderLock } from './renderLock.ts';

/** A lock path in a throwaway folder. */
function lockPath(): string {
	return join(mkdtempSync(join(tmpdir(), 'lock-')), 'current.lock');
}

/** A process ID that belonged to a process that has ended. */
function goneProcess(): number {
	return spawnSync('true').pid;
}

describe('RenderLock', () => {
	it('takes the lock with this process and the label', () => {
		const path = lockPath();
		new RenderLock(path).take('figure-s11');
		expect(readFileSync(path, 'utf8')).toBe(`${String(process.pid)}\tfigure-s11`);
	});

	it('answers busy when the file is already there, even from a render that was quicker', () => {
		const path = lockPath();
		writeFileSync(path, '');
		const failure: unknown = ((): unknown => {
			try {
				new RenderLock(path).take('figure-s11');
				return null;
			} catch (error) {
				return error;
			}
		})();
		expect(failure instanceof RenderException && failure.key).toBe(RenderExceptionKey.Busy);
	});

	it('rewrites the lock through a side file it does not leave behind', () => {
		const path = lockPath();
		const lock = new RenderLock(path);
		lock.take('figure-s11');
		lock.update([process.pid, 4711], 'figure-s11 3/8');
		expect([readFileSync(path, 'utf8'), existsSync(`${path}.next`)]).toEqual([
			`${String(process.pid)},4711\tfigure-s11 3/8`,
			false,
		]);
	});

	it.each([
		['an empty lock', ''],
		['a lock without a process ID', 'abc\tfigure-s9'],
		['a lock whose processes are gone', `${String(goneProcess())},${String(goneProcess())}\tfigure-s9`],
	])('clears %s', (_, line) => {
		const path = lockPath();
		writeFileSync(path, line);
		expect([new RenderLock(path).running(), existsSync(path)]).toEqual([null, false]);
	});

	it('stays running while the second process still lives, though the first is gone', () => {
		const path = lockPath();
		writeFileSync(path, `${String(goneProcess())},${String(process.pid)}\tfigure-s9 3/8`);
		expect(new RenderLock(path).running()).toBe('figure-s9 3/8');
	});

	it('releases the lock', () => {
		const path = lockPath();
		const lock = new RenderLock(path);
		lock.take('figure-s11');
		lock.release();
		expect(existsSync(path)).toBe(false);
	});
});
