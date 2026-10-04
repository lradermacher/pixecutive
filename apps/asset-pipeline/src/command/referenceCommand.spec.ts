import { describe, expect, it } from 'vitest';
import { AssetExceptionKey, ReferenceDevelopmentService } from '@pixecutive/core';
import { join } from 'node:path';
import { loadAssetData } from '../load-asset-data.ts';
import { referenceCommand } from './referenceCommand.ts';

const data = loadAssetData(join(import.meta.dirname, '..', '..', 'data'));

describe('referenceCommand', () => {
	it('returns only the prompt on a dry run', async () => {
		const outcome = await referenceCommand(data, 'base-m', null);
		expect(outcome.verdict).toBeNull();
		expect(outcome.prompt).toContain('A slim, lean young man');
	});

	it('develops a reference through the given service', async () => {
		const development = new ReferenceDevelopmentService(
			{
				render: (_input: string, _prompt: string, seed: number): Promise<{ image: string | null; problem: string }> =>
					Promise.resolve({ image: `r-${String(seed)}.png`, problem: '' }),
			},
			{ failedFeatures: (): Promise<readonly string[]> => Promise.resolve([]) },
			{ append: (): Promise<void> => Promise.resolve() },
			{ now: (): Date => new Date('2026-10-04T20:30:00.000Z') },
		);
		expect((await referenceCommand(data, 'base-f', development)).verdict?.image).toBe('r-11.png');
	});

	it('rejects an unknown figure by name', async () => {
		await expect(referenceCommand(data, 'base-x', null)).rejects.toThrow(AssetExceptionKey.InvalidData);
	});
});
