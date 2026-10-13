import { describe, expect, it } from 'vitest';
import { headCutConfigSchema } from './headCutConfig.schema.ts';

describe('headCutConfigSchema', () => {
	it('defaults to the values the proof of concept cut its head parts with', () => {
		const config = headCutConfigSchema.parse({});
		expect([
			config.key.coarse,
			config.key.fine,
			[config.key.green, config.key.background, config.key.changed, config.key.spill, config.key.ring],
			config.key.smallest,
			[config.hat.changed, config.hat.green, config.hat.hide, config.hat.hideReach],
			[config.glasses.coarse.shift, config.glasses.fine.shift, config.glasses.changed],
			[config.variant.coarse.scaleTo, config.variant.fine.scale, config.variant.opacityFrom, config.variant.edge],
			[config.skull, config.lift],
		]).toEqual([
			{ scaleFrom: 0.95, scaleTo: 1.05, scaleStep: 0.01, shift: 8, shiftStep: 2 },
			{ scale: 0.01, scaleStep: 0.0025, shift: 2, shiftStep: 0.5 },
			[90, 45, 55, 4, 160],
			{ hair: 400, beard: 40, hairUnderHat: 80 },
			[60, 40, 12, 75],
			[16, 3, 70],
			[1.05, 0.008, 45, { brows: 6, eyes: 9, nose: 9, mouth: 9 }],
			[60, 30],
		]);
	});

	it.each([
		[
			'a scale search that runs downwards',
			{ key: { coarse: { scaleFrom: 1.1, scaleTo: 0.9, scaleStep: 0.01, shift: 8, shiftStep: 2 } } },
		],
		['a level above 255', { hat: { green: 300 } }],
		['a head share of the whole image', { hat: { head: 1 } }],
	])('refuses %s', (_, invalid) => {
		expect(headCutConfigSchema.safeParse(invalid).success).toBe(false);
	});
});
