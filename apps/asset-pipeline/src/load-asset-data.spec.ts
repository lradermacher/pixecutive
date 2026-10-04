import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AssetExceptionKey, ReferencePromptService } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { loadAssetData } from './load-asset-data.ts';

const dataDir = join(import.meta.dirname, '..', 'data');

describe('loadAssetData', () => {
	it('loads the real data files and both base specs', () => {
		const data = loadAssetData(dataDir);
		expect(data.specs.map((spec) => spec.id).sort()).toEqual(['base-f', 'base-m']);
		expect(data.designLine.choices.map((choice) => choice.key)).toContain('pixel-grid');
	});

	it('builds a prompt for every base spec without a forbidden phrase', () => {
		const data = loadAssetData(dataDir);
		for (const spec of data.specs)
			expect(new ReferencePromptService().build(data.template, spec, data.errorTypes)).toContain('chroma-key green');
	});

	it('rejects a broken spec next to valid data', () => {
		const dir = mkdtempSync(join(tmpdir(), 'asset-data-'));
		mkdirSync(join(dir, 'specs'));
		for (const name of ['design-line.json', 'reference-template.json', 'error-types.json'])
			copyFileSync(join(dataDir, name), join(dir, name));
		writeFileSync(join(dir, 'specs', 'bad.json'), JSON.stringify({ id: 'bad' }));
		expect(() => loadAssetData(dir)).toThrow(AssetExceptionKey.InvalidData);
	});
});
