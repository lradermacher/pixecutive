import { describe, expect, it } from 'vitest';
import { Joint } from './joint.enum.ts';
import { characterSpecSchema } from './characterSpec.schema.ts';

const valid = {
	id: 'base-m',
	baseImage: 'base-m.png',
	features: [{ id: 'eyes', description: 'eyes', promptSentence: 'Eyes.', check: 'vision', source: 'sheet' }],
	joints: ['pelvis', 'head'],
	animations: ['idle'],
};

describe('characterSpecSchema', () => {
	it('accepts a valid spec', () => {
		expect(characterSpecSchema.parse(valid).joints).toEqual([Joint.Pelvis, Joint.Head]);
	});

	it('rejects an unknown check and an unknown joint', () => {
		expect(
			characterSpecSchema.safeParse({ ...valid, features: [{ ...valid.features[0], check: 'eyeball' }] }).success,
		).toBe(false);
		expect(characterSpecSchema.safeParse({ ...valid, joints: ['tail'] }).success).toBe(false);
	});
});
