import { describe, expect, it } from 'vitest';
import { fixtureManifest } from './fixtureManifest.ts';
import { readManifest } from './readManifest.ts';

describe('readManifest', () => {
	it('answers a manifest the protocol accepts', () => {
		expect(readManifest(JSON.parse(JSON.stringify(fixtureManifest)))).toEqual({ manifest: fixtureManifest });
	});

	it('answers why it refuses one, naming each field by its path', () => {
		const json = JSON.parse(JSON.stringify(fixtureManifest)) as { version: number; figures: unknown };
		json.version = 2;
		expect(readManifest(json)).toEqual({ reason: expect.stringMatching(/^version: /) as unknown });
	});

	it('names the whole manifest when there is none', () => {
		expect(readManifest(null)).toEqual({ reason: expect.stringMatching(/^manifest: /) as unknown });
	});
});
