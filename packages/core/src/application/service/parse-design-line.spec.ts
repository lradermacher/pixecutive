import { describe, expect, it } from 'vitest';
import { parseDesignLine } from './parse-design-line.ts';

describe('parseDesignLine', () => {
	it('reads every choice with its source', () => {
		const line = parseDesignLine(
			{ choices: [{ key: 'outline', value: '1 px #1B1410', source: 'pix57-plan F2' }] },
			'd.json',
		);
		expect(line.choices[0]?.source).toBe('pix57-plan F2');
	});

	it('rejects a choice without a source', () => {
		expect(() => parseDesignLine({ choices: [{ key: 'outline', value: 'x' }] }, 'd.json')).toThrow(
			'd.json.choices[0].source',
		);
	});
});
