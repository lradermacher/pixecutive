import { describe, expect, it } from 'vitest';
import { headPartsSpecSchema } from './headPartsSpec.schema.ts';

const head = { columns: 3, rows: 3, width: 1024, height: 1024, box: { left: 120, top: 60, right: 400, bottom: 340 } };
const spec = {
	green: 'm/green.png',
	greenOpen: 'm/green-open.png',
	grids: { head },
	kinds: {
		hair: { ids: [1, 2, 3], grid: 'head' },
		hat: { ids: [4, 12], openTop: [12] },
		glasses: { ids: [1], fittedFrom: { figure: 'm', scale: 0.98, dx: -20.5, dy: -10.5 } },
	},
};

describe('headPartsSpecSchema', () => {
	it('accepts the green stills, the grids and per kind the variants, the grid, the open hats and the fit', () => {
		expect(headPartsSpecSchema.parse(spec)).toEqual(spec);
	});

	it.each([
		['a variant twice', { ...spec, kinds: { hair: { ids: [1, 1], grid: 'head' } } }],
		['a grid the figure does not define', { ...spec, kinds: { hair: { ids: [1], grid: 'tall' } } }],
		['an open hat that is no hat', { ...spec, kinds: { hat: { ids: [4], openTop: [12] } } }],
		['an open top on hair', { ...spec, kinds: { hair: { ids: [1], openTop: [1] } } }],
		['a kind that does not exist', { ...spec, kinds: { cape: { ids: [1] } } }],
		['a green still that is no PNG', { ...spec, green: 'm/green.jpg' }],
	])('refuses %s', (_, invalid) => {
		expect(headPartsSpecSchema.safeParse(invalid).success).toBe(false);
	});
});
