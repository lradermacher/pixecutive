// frameCount.schema.ts — how many frames one clip of the local video model has, as the clip job and the figures'
// specs both check it.
import { z } from 'zod';

/** The video model renders 8k + 1 frames; 9 is its shortest clip, 257 the longest that fits the memory. */
export const frameCountSchema = z
	.int()
	.min(9)
	.max(257)
	.refine((n) => (n - 1) % 8 === 0, 'a clip has 8k + 1 frames');
