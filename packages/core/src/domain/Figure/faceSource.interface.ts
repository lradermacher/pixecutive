// faceSource.interface.ts — a face part as drawn on the still, before it is scaled to a motion.
import type { FacePart } from './facePart.enum.ts';

/** The part, its image on the still and, for the blank head, the mask of the face it covers. */
export interface FaceSource {
	readonly part: FacePart;
	readonly image: string;
	readonly mask?: string;
}
