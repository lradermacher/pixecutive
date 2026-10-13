import { describe, expect, it } from 'vitest';
import { gridLayoutSchema } from './gridLayout.schema.ts';

const head = { columns: 3, rows: 3, width: 1024, height: 1024, box: { left: 120, top: 60, right: 400, bottom: 340 } };

describe('gridLayoutSchema', () => {
	it('accepts the head grid of the proof of concept', () => {
		expect(gridLayoutSchema.parse(head)).toEqual(head);
	});

	it.each([
		['no cell across', { ...head, columns: 0 }],
		['an image too small', { ...head, width: 8 }],
		['a box without area', { ...head, box: { ...head.box, right: 120 } }],
	])('refuses %s', (_, invalid) => {
		expect(gridLayoutSchema.safeParse(invalid).success).toBe(false);
	});
});
