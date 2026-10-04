import { describe, expect, it } from 'vitest';
import { AssetErrorKey } from './asset-error-key.ts';
import { AssetException } from './asset-exception.ts';

describe('AssetException', () => {
	it('carries its key and names it in the message', () => {
		const error = new AssetException(AssetErrorKey.InvalidData, 'x is wrong');
		expect(error.key).toBe(AssetErrorKey.InvalidData);
		expect(error.message).toBe('asset.invalid-data: x is wrong');
	});
});
