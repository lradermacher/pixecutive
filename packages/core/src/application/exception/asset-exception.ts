// asset-exception.ts — the core exception of the asset pipeline: a key for the edge, a detail for the log.
import type { AssetErrorKey } from './asset-error-key.ts';

/** A failure of the asset pipeline, identified by its key. */
export class AssetException extends Error {
	readonly key: AssetErrorKey;

	constructor(key: AssetErrorKey, detail: string) {
		super(`${key}: ${detail}`);
		this.key = key;
	}
}
