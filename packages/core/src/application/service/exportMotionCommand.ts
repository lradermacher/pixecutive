// exportMotionCommand.ts — the input of the use case "export a motion": a cut clip, its head track and its face.
import type { CutResult } from '../../domain/Figure/cutResult.schema.ts';
import type { ExportConfig } from '../../domain/Figure/exportConfig.schema.ts';
import type { FaceSource } from '../../domain/Figure/faceSource.interface.ts';
import type { FigureName } from '../../domain/Figure/figureName.enum.ts';
import type { FramePlan } from '../../domain/Figure/framePlan.schema.ts';
import type { HeadPartSource } from '../../domain/Figure/headPartSource.interface.ts';
import type { HeadTrack } from '../../domain/Figure/headTrack.schema.ts';
import type { Motion } from '../../domain/Figure/motion.enum.ts';
import type { FrameRange } from './planFrames.service.ts';

/**
 * A motion to export: the sprites as cut with their plan, the sprites the office uses (`use`, default all; an idle cut
 * over the whole clip uses a calm range of it), the head track of exactly those sprites, the face parts, and the head
 * parts' variants when the figure has them.
 */
export interface ExportMotionCommand {
	readonly figure: FigureName;
	readonly motion: Motion;
	readonly plan: FramePlan;
	readonly cut: CutResult;
	readonly use?: FrameRange;
	readonly track: HeadTrack;
	readonly face: readonly FaceSource[];
	readonly head?: readonly HeadPartSource[];
	/** What holds for the figure's head parts in every motion: the lift per hairstyle and the open hats. */
	readonly figureHead?: { readonly lift: Readonly<Record<string, number>>; readonly openTop: readonly number[] };
	readonly values: ExportConfig;
}
