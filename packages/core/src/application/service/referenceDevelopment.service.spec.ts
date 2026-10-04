import { describe, expect, it } from 'vitest';
import { FeatureCheck } from '../../domain/Asset/featureCheck.enum.ts';
import type { Verdict } from '../../domain/Asset/verdict.interface.ts';
import { AssetExceptionKey } from '../exception/assetExceptionKey.enum.ts';
import { ReferenceDevelopmentService } from './referenceDevelopment.service.ts';

const spec = {
	id: 'base-m',
	baseImage: 'base-m.png',
	features: [
		{ id: 'mouth', description: 'mouth', promptSentence: 'A mouth.', check: FeatureCheck.Vision, source: 'sheet' },
		{ id: 'name', description: 'name', promptSentence: '', check: FeatureCheck.None, source: 'chat' },
	],
	joints: [],
	animations: [],
};
const instant = new globalThis.Date('2026-10-04T20:00:00.000Z');

/** A service over fake ports: renders always finish (or never), and the reference of `passingSeed` passes. */
function fakeRun(
	passingSeed: number,
	finished = true,
): { service: ReferenceDevelopmentService; logged: Verdict[]; seeds: number[] } {
	const logged: Verdict[] = [];
	const seeds: number[] = [];
	const service = new ReferenceDevelopmentService(
		{
			render: (_input: string, _prompt: string, seed: number): Promise<{ image: string | null; problem: string }> => {
				seeds.push(seed);
				return Promise.resolve(
					finished ? { image: `r-${String(seed)}.png`, problem: '' } : { image: null, problem: 'swap limit' },
				);
			},
		},
		{
			failedFeatures: (image, features): Promise<readonly string[]> =>
				Promise.resolve(image === `r-${String(passingSeed)}.png` ? [] : features.map((feature) => feature.id)),
		},
		{
			append: (verdict: Verdict): Promise<void> => {
				logged.push(verdict);
				return Promise.resolve();
			},
		},
		{ now: (): Date => instant },
	);
	return { service, logged, seeds };
}

describe('ReferenceDevelopmentService', () => {
	it('returns the first passing reference and logs each check', async () => {
		const run = fakeRun(12);
		expect(await run.service.develop(spec, 'p', 11)).toMatchObject({ seed: 12, attempt: 2, failures: [], at: instant });
		expect(run.logged.map((entry) => entry.failures)).toEqual([['mouth'], []]);
	});

	it('checks only the features marked for vision', async () => {
		const run = fakeRun(99);
		await expect(run.service.develop(spec, 'p', 11)).rejects.toThrow(AssetExceptionKey.NoPassingReference);
		expect(run.logged[0]?.failures).toEqual(['mouth']);
	});

	it('stops after the first render and three retries', async () => {
		const run = fakeRun(99);
		await expect(run.service.develop(spec, 'p', 11)).rejects.toThrow(AssetExceptionKey.NoPassingReference);
		expect(run.seeds).toEqual([11, 12, 13, 14]);
	});

	it('ends the run when the guard stopped a render', async () => {
		const run = fakeRun(11, false);
		await expect(run.service.develop(spec, 'p', 11)).rejects.toThrow('swap limit');
		expect(run.seeds).toEqual([11]);
	});
});
