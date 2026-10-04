import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { statusCommand } from './statusCommand.ts';

describe('statusCommand', () => {
	it('says idle without a lock and shows the last five log rows', () => {
		const dir = mkdtempSync(join(tmpdir(), 'status-'));
		writeFileSync(join(dir, 'renders.tsv'), ['1', '2', '3', '4', '5', '6'].join('\n'));
		expect(statusCommand(dir, { pressure: 1, swapMb: 7000 })).toEqual([
			'idle',
			'memory pressure 1 · swap 7000 MB',
			'2',
			'3',
			'4',
			'5',
			'6',
		]);
	});

	it('names the running render', () => {
		const dir = mkdtempSync(join(tmpdir(), 'status-'));
		writeFileSync(join(dir, 'current.lock'), 'ref-11');
		expect(statusCommand(dir, { pressure: 2, swapMb: 9000 })[0]).toBe('running ref-11');
	});
});
