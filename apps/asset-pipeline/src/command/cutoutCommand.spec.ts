import { join } from 'node:path';
import { AssetExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { loadAssetData } from '../load-asset-data.ts';
import { cutoutCommand } from './cutoutCommand.ts';

const data = loadAssetData(join(import.meta.dirname, '..', '..', 'data'));

describe('cutoutCommand', () => {
	it('cuts as many panels as the template has views into the figure folder', async () => {
		const calls: unknown[][] = [];
		const cutout = {
			cut: (...args: [string, number, string, string]): Promise<readonly string[]> => {
				calls.push(args);
				return Promise.resolve(['v0.png']);
			},
		};
		expect(await cutoutCommand(data, 'base-m', 'ref.png', '/r', cutout)).toEqual(['v0.png']);
		expect(calls[0]).toEqual(['ref.png', 2, '#00B140', join('/r', 'base-m', 'views')]);
	});

	it('rejects an unknown figure', () => {
		expect(() => cutoutCommand(data, 'base-x', 'ref.png', '/r', { cut: () => Promise.resolve([]) })).toThrow(
			AssetExceptionKey.InvalidData,
		);
	});
});
