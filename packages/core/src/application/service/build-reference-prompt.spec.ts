import { describe, expect, it } from 'vitest';
import { FeatureCheck } from '../../domain/asset/feature-check.ts';
import { View } from '../../domain/asset/view.ts';
import { AssetErrorKey } from '../exception/asset-error-key.ts';
import { buildReferencePrompt } from './build-reference-prompt.ts';

const template = {
	views: [View.Front],
	prompt: 'A figure on a flat studio green background. {features} Full body.',
	width: 640,
	height: 832,
	seed: 11,
	keyColor: '#00B140',
};
const spec = {
	id: 'base-m',
	baseImage: 'base-m.png',
	features: [
		{ id: 'eyes', description: 'eyes', promptSentence: 'Dark oval eyes.', check: FeatureCheck.Vision, source: 'F2' },
		{ id: 'mouth', description: 'mouth', promptSentence: 'A smiling mouth.', check: FeatureCheck.Vision, source: 'F2' },
	],
	joints: [],
	animations: [],
};

describe('buildReferencePrompt', () => {
	it('inserts every feature sentence where the template says {features}', () => {
		expect(buildReferencePrompt(template, spec, [])).toBe(
			'A figure on a flat studio green background. Dark oval eyes. A smiling mouth. Full body.',
		);
	});

	it('strips the phrases an error type removes', () => {
		const types = [{ id: 'F08', description: 'a real photo studio appears', strip: ['studio '], forbid: [] }];
		expect(buildReferencePrompt(template, spec, types)).toContain('a flat green background');
	});

	it('rejects a prompt that still holds a forbidden phrase', () => {
		const types = [{ id: 'F12', description: 'a third arm appears', strip: [], forbid: ['Full body'] }];
		expect(() => buildReferencePrompt(template, spec, types)).toThrow(AssetErrorKey.ForbiddenPrompt);
	});

	it('rejects a template without the placeholder', () => {
		expect(() => buildReferencePrompt({ ...template, prompt: 'no slot' }, spec, [])).toThrow(AssetErrorKey.InvalidData);
	});
});
