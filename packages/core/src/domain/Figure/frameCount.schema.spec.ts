import { describe, expect, it } from 'vitest';
import { frameCountSchema } from './frameCount.schema.ts';

describe('frameCountSchema', () => {
	it.each([9, 49, 257])('accepts a clip of %i frames', (frames) => {
		expect(frameCountSchema.parse(frames)).toBe(frames);
	});

	it.each([1, 48, 265])('refuses a clip of %i frames', (frames) => {
		expect(frameCountSchema.safeParse(frames).success).toBe(false);
	});
});
