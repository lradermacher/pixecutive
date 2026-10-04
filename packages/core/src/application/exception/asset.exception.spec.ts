import { describe, expect, it } from 'vitest';
import { AssetException } from './asset.exception.ts';
import { AssetExceptionKey } from './assetExceptionKey.enum.ts';

describe('AssetException', () => {
	it('carries its key and names it in the message', () => {
		const error = new AssetException(AssetExceptionKey.InvalidData, 'x is wrong');
		expect(error.key).toBe(AssetExceptionKey.InvalidData);
		expect(error.message).toBe('asset.invalid_data: x is wrong');
		expect(error.name).toBe('AssetException');
	});
});
