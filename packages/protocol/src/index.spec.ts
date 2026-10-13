import { describe, expect, it } from 'vitest';
import { FacePart, figureManifestSchema, HeadLayer, HeadPartKind, packageName } from './index.ts';

describe('@pixecutive/protocol', () => {
	it('exposes its workspace name through its entry', () => {
		expect(packageName).toBe('@pixecutive/protocol');
	});

	it('exposes the figure manifest through its entry', () => {
		expect([FacePart.EyesHalf, figureManifestSchema.safeParse({ version: 1, figures: {} }).success]).toEqual([
			'eyes-half',
			true,
		]);
	});

	it('exposes the head part kinds and the head layers in their drawing order through its entry', () => {
		expect([HeadPartKind.HairUnderHat, Object.values(HeadLayer)]).toEqual([
			'hair-under-hat',
			['beard', 'hat-hide', 'hair', 'glasses', 'hat'],
		]);
	});
});
