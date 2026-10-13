// headPartSource.interface.ts — one head part variant as its cut layer in still pixels, and a hat's hide beside it.
import type { HeadPartKind } from './headPartKind.enum.ts';

/** The layer of one variant of a kind, and for a hat the hide that cuts the head away where the hat replaces it. */
export interface HeadPartSource {
	readonly kind: HeadPartKind;
	readonly id: number;
	readonly image: string;
	readonly hide?: string;
}
