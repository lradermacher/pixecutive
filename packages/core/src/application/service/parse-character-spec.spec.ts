import { describe, expect, it } from 'vitest';
import { Animation } from '../../domain/asset/animation.ts';
import { Joint } from '../../domain/asset/joint.ts';
import { parseCharacterSpec } from './parse-character-spec.ts';

const valid = {
	id: 'base-m',
	baseImage: 'base-m.png',
	features: [{ id: 'eyes', description: 'eyes', promptSentence: 'Eyes.', check: 'vision', source: 'F2' }],
	joints: ['pelvis', 'head'],
	animations: ['idle'],
};

describe('parseCharacterSpec', () => {
	it('reads a valid spec', () => {
		const spec = parseCharacterSpec(valid, 'base-m.json');
		expect(spec.joints).toEqual([Joint.Pelvis, Joint.Head]);
		expect(spec.animations).toEqual([Animation.Idle]);
	});

	it('rejects an unknown check', () => {
		const broken = { ...valid, features: [{ ...valid.features[0], check: 'eyeball' }] };
		expect(() => parseCharacterSpec(broken, 'base-m.json')).toThrow('base-m.json.features[0].check');
	});
});
