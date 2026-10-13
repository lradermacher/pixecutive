import { describe, expect, it } from 'vitest';
import { figurePathsSchema } from './figurePaths.schema.ts';

const paths = { rendersDir: '/r', sources: '/r/figures', uv: 'uv' };

describe('figurePathsSchema', () => {
	it('accepts the three paths', () => {
		expect(figurePathsSchema.parse(paths)).toEqual(paths);
	});

	it.each(['rendersDir', 'sources', 'uv'])('refuses an empty %s and one of blanks only', (field) => {
		expect([
			figurePathsSchema.safeParse({ ...paths, [field]: '' }).success,
			figurePathsSchema.safeParse({ ...paths, [field]: ' ' }).success,
		]).toEqual([false, false]);
	});
});
