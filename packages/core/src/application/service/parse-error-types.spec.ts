import { describe, expect, it } from 'vitest';
import { parseErrorTypes } from './parse-error-types.ts';

describe('parseErrorTypes', () => {
	it('reads every type with its countermeasures', () => {
		const types = parseErrorTypes({ types: [{ id: 'F1', description: 'd', strip: ['a'], forbid: [] }] }, 'e.json');
		expect(types[0]?.strip).toEqual(['a']);
	});

	it('rejects a countermeasure that is no list of strings', () => {
		expect(() =>
			parseErrorTypes({ types: [{ id: 'F1', description: 'd', strip: [1], forbid: [] }] }, 'e.json'),
		).toThrow('e.json.types[0].strip[0]');
	});
});
