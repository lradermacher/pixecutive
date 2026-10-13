// frameCutConfig.schema.ts — the values that cut a clip into sprites, each with the default the shipped base figures
// were made with. Parsed at the app's start; a test pins them, a change is one line.
import { z } from 'zod';

/** How the figure is told from the background, when a pose counts as new, and the sprite's margin and height. */
export const frameCutConfigSchema = z.object({
	/** Color distance (sum of RGB) under which a pixel joins the background flood from the border. */
	background: z.int().min(1).max(765).default(60),
	/** Color distance under which a pixel inside the figure still counts as background. */
	inside: z.int().min(1).max(765).default(35),
	/** Mean change from the previous video frame above which a frame starts a new pose (0-255). */
	poseChange: z.number().positive().default(3),
	/** Share of the figure's height from the top below which the feet are measured for the leg spread. */
	legBand: z.number().gt(0).lt(1).default(0.75),
	/** Share of the figure's height from the top that holds the head, whose centre carries the drift. */
	headBand: z.number().gt(0).lt(1).default(0.3),
	/** Margin around the figure in video pixels: above, below, left, right. */
	margin: z
		.object({ top: z.int().min(0), bottom: z.int().min(0), left: z.int().min(0), right: z.int().min(0) })
		.default({ top: 2, bottom: 0, left: 2, right: 2 }),
	/** The tallest sprite of a motion in pixels. */
	height: z.int().min(16).max(1024).default(200),
});

export type FrameCutConfig = z.infer<typeof frameCutConfigSchema>;
