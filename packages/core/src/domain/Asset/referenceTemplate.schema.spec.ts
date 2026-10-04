import { describe, expect, it } from 'vitest';
import { referenceTemplateSchema } from './referenceTemplate.schema.ts';

const valid = {
	views: ['front', 'side'],
	prompt: 'A {features}',
	width: 640,
	height: 832,
	seed: 11,
	keyColor: '#00B140',
};

describe('referenceTemplateSchema', () => {
	it('accepts a valid template', () => {
		expect(referenceTemplateSchema.parse(valid).width).toBe(640);
	});

	it('rejects a prompt without the placeholder and a key color that is no hex color', () => {
		expect(referenceTemplateSchema.safeParse({ ...valid, prompt: 'A figure' }).success).toBe(false);
		expect(referenceTemplateSchema.safeParse({ ...valid, keyColor: 'green' }).success).toBe(false);
	});
});
