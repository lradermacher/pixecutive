import { describe, expect, it } from 'vitest';
import { handStatesSchema } from './handStates.schema.ts';

const box = { left: 420, top: 360, right: 600, bottom: 460 };

describe('handStatesSchema', () => {
	it('accepts the hands box and its states, four sprite frames per state by default', () => {
		expect(handStatesSchema.parse({ box, states: ['m/type-lifted.png'] })).toEqual({
			box,
			states: ['m/type-lifted.png'],
			ticks: 4,
		});
	});

	it.each([
		['no state', { box, states: [] }],
		['a state that is no PNG', { box, states: ['m/type.jpg'] }],
		['a box without area', { box: { ...box, right: 420 }, states: ['m/a.png'] }],
	])('refuses %s', (_, invalid) => {
		expect(handStatesSchema.safeParse(invalid).success).toBe(false);
	});
});
