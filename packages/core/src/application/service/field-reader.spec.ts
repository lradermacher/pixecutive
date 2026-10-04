import { describe, expect, it } from 'vitest';
import { View } from '../../domain/asset/view.ts';
import { FieldReader } from './field-reader.ts';

describe('FieldReader', () => {
	const reader = new FieldReader({ name: 'a', size: 3, views: ['front'], list: [{ id: 'x' }] }, 'file.json');

	it('reads typed fields', () => {
		expect([reader.text('name'), reader.whole('size'), reader.members('views', View)]).toEqual(['a', 3, [View.Front]]);
		expect(reader.child('list', 0).text('id')).toBe('x');
	});

	it('names the exact path of a wrong field', () => {
		expect(() => reader.text('size')).toThrow('file.json.size must be a non-empty string');
		expect(() => reader.child('list', 0).whole('id')).toThrow('file.json.list[0].id must be a whole number');
	});

	it('rejects a value outside the allowed set', () => {
		expect(() => new FieldReader({ views: ['top'] }, 'f').members('views', View)).toThrow('values out of');
	});

	it('rejects what is no object', () => {
		expect(() => new FieldReader([], 'f')).toThrow('f is no object');
	});
});
