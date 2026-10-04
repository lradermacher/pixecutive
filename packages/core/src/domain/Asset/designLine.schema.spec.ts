import { describe, expect, it } from 'vitest';
import { designLineSchema } from './designLine.schema.ts';

describe('designLineSchema', () => {
	it('accepts every choice with its source', () => {
		expect(
			designLineSchema.parse({ choices: [{ key: 'outline', value: '1 px', source: 'sheet F2' }] }).choices[0]?.source,
		).toBe('sheet F2');
	});

	it('rejects a choice without a source', () => {
		expect(designLineSchema.safeParse({ choices: [{ key: 'outline', value: '1 px' }] }).success).toBe(false);
	});
});
