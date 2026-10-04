import { describe, expect, it } from 'vitest';
import { FeatureCheck } from '../../domain/Asset/featureCheck.enum.ts';
import { View } from '../../domain/Asset/view.enum.ts';
import { AssetExceptionKey } from '../exception/assetExceptionKey.enum.ts';
import { ReferencePromptService } from './referencePrompt.service.ts';

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
		{ id: 'eyes', description: 'eyes', promptSentence: 'Dark oval eyes.', check: FeatureCheck.Vision, source: 'sheet' },
		{
			id: 'mouth',
			description: 'mouth',
			promptSentence: 'A smiling mouth.',
			check: FeatureCheck.Vision,
			source: 'sheet',
		},
	],
	joints: [],
	animations: [],
};
const service = new ReferencePromptService();

describe('ReferencePromptService', () => {
	it('inserts every feature sentence where the template says {features}', () => {
		expect(service.build(template, spec, [])).toBe(
			'A figure on a flat studio green background. Dark oval eyes. A smiling mouth. Full body.',
		);
	});

	it('strips the phrases an error type removes', () => {
		const types = [{ id: 'E03', description: 'a photo studio appears', strip: ['studio '], forbid: [] }];
		expect(service.build(template, spec, types)).toContain('a flat green background');
	});

	it('rejects a prompt that still holds a forbidden phrase', () => {
		const types = [{ id: 'E04', description: 'an extra arm appears', strip: [], forbid: ['Full body'] }];
		expect(() => service.build(template, spec, types)).toThrow(AssetExceptionKey.ForbiddenPrompt);
	});
});
