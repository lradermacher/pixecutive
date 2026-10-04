import { describe, expect, it } from 'vitest';
import type { Verdict } from '../../domain/asset/verdict.ts';
import { FeatureCheck } from '../../domain/asset/feature-check.ts';
import { AssetErrorKey } from '../exception/asset-error-key.ts';
import { developReference } from './develop-reference.ts';

const spec = {
	id: 'base-m',
	baseImage: 'base-m.png',
	features: [
		{ id: 'mouth', description: 'mouth', promptSentence: 'A mouth.', check: FeatureCheck.Vision, source: 'F2' },
		{ id: 'name', description: 'name', promptSentence: '', check: FeatureCheck.None, source: 'chat' },
	],
	joints: [],
	animations: [],
};

function ports(
	passOnAttempt: number,
	finished = true,
): { logged: Verdict[]; seeds: number[]; value: Parameters<typeof developReference>[0] } {
	const logged: Verdict[] = [];
	const seeds: number[] = [];
	return {
		logged,
		seeds,
		value: {
			renderer: {
				render: (_input: string, _prompt: string, seed: number): Promise<{ image: string | null; problem: string }> => {
					seeds.push(seed);
					return Promise.resolve(
						finished ? { image: `r-${String(seed)}.png`, problem: '' } : { image: null, problem: 'swap limit' },
					);
				},
			},
			checker: {
				failedFeatures: (image, features) =>
					Promise.resolve(image === `r-${String(10 + passOnAttempt)}.png` ? [] : features.map((feature) => feature.id)),
			},
			log: {
				append: (verdict: Verdict): Promise<void> => {
					logged.push(verdict);
					return Promise.resolve();
				},
			},
			clock: { nowIso: () => '2026-10-04T20:00:00.000Z' },
		},
	};
}

describe('developReference', () => {
	it('returns the first passing reference and logs each check', async () => {
		const run = ports(2);
		const verdict = await developReference(run.value, spec, 'p', 11);
		expect(verdict).toMatchObject({ seed: 12, attempt: 2, failures: [] });
		expect(run.logged.map((entry) => entry.failures)).toEqual([['mouth'], []]);
	});

	it('checks only the features marked for vision', async () => {
		const run = ports(9);
		await expect(developReference(run.value, spec, 'p', 11)).rejects.toThrow(AssetErrorKey.NoPassingReference);
		expect(run.logged[0]?.failures).toEqual(['mouth']);
	});

	it('stops after the first render and three retries', async () => {
		const run = ports(9);
		await expect(developReference(run.value, spec, 'p', 11)).rejects.toThrow(AssetErrorKey.NoPassingReference);
		expect(run.seeds).toEqual([11, 12, 13, 14]);
	});

	it('ends the run when the guard stopped a render', async () => {
		const run = ports(1, false);
		await expect(developReference(run.value, spec, 'p', 11)).rejects.toThrow('swap limit');
		expect(run.seeds).toEqual([11]);
	});
});
