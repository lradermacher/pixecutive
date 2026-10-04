import { describe, expect, it } from 'vitest';
import { errorTypesSchema } from './errorType.schema.ts';

describe('errorTypesSchema', () => {
	it('accepts every type with its countermeasures', () => {
		expect(
			errorTypesSchema.parse({ types: [{ id: 'E1', description: 'd', strip: ['a'], forbid: [] }] }).types[0]?.strip,
		).toEqual(['a']);
	});

	it('rejects a countermeasure that is no list of strings', () => {
		expect(
			errorTypesSchema.safeParse({ types: [{ id: 'E1', description: 'd', strip: [1], forbid: [] }] }).success,
		).toBe(false);
	});
});
