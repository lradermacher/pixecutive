import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonlVerdictLogAdapter } from './verdictLog-jsonl.adapter.ts';

describe('JsonlVerdictLogAdapter', () => {
	it('appends one JSON line per verdict', async () => {
		const file = join(mkdtempSync(join(tmpdir(), 'verdicts-')), 'nested', 'verdicts.jsonl');
		const log = new JsonlVerdictLogAdapter(file);
		const verdict = {
			figure: 'base-m',
			image: 'r.png',
			seed: 11,
			attempt: 1,
			failures: ['mouth'],
			at: new Date('2026-10-04T20:30:00.000Z'),
		};
		await log.append(verdict);
		await log.append({ ...verdict, attempt: 2, failures: [] });
		const lines = readFileSync(file, 'utf8')
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(lines.map((line) => line['attempt'])).toEqual([1, 2]);
		expect(lines[0]?.['at']).toBe('2026-10-04T20:30:00.000Z');
	});
});
