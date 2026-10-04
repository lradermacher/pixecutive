// asset.exception.ts — the framework-free exception of the asset pipeline: a stable key plus a detail for the log.
import type { AssetExceptionKey } from './assetExceptionKey.enum.ts';

/** A failure of the asset pipeline. The app's command line maps the key to its message and exit code. */
export class AssetException extends Error {
	constructor(
		public readonly key: AssetExceptionKey,
		detail: string,
	) {
		super(`${key}: ${detail}`);
		this.name = 'AssetException';
	}
}
