// cutFramesCommand.ts — the input of the use case "cut a clip into sprites".
import type { ClipMode } from '../../domain/Figure/clipMode.enum.ts';
import type { FrameCutConfig } from '../../domain/Figure/frameCutConfig.schema.ts';
import type { FrameRange } from './planFrames.service.ts';

/**
 * A clip and how to cut it. A loop takes `range` (default: the whole clip) every `step` frames, forward only or
 * forward and back; a cycle takes `range` as its bounds when given, else finds them by the leg spread.
 */
export interface CutFramesCommand {
	readonly clip: string;
	readonly mode: ClipMode;
	readonly values: FrameCutConfig;
	readonly range?: FrameRange;
	readonly step?: number;
	readonly forward?: boolean;
}
