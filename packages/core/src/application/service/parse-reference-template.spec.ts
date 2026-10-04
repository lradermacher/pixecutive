import { describe, expect, it } from 'vitest';
import { parseReferenceTemplate } from './parse-reference-template.ts';

const valid = {
	views: ['front', 'side'],
	prompt: 'A {features}',
	width: 640,
	height: 832,
	seed: 11,
	keyColor: '#00B140',
};

describe('parseReferenceTemplate', () => {
	it('reads a valid template', () => {
		expect(parseReferenceTemplate(valid, 't.json').width).toBe(640);
	});

	it('rejects a size that is no whole number', () => {
		expect(() => parseReferenceTemplate({ ...valid, width: 1.5 }, 't.json')).toThrow('t.json.width');
	});
});
