// trackHeadCommand.ts — the input of the use case "track the head", as a caller hands it in.
import type { HeadTrackConfig } from '../../domain/Figure/headTrackConfig.schema.ts';

/** What the caller asks to track; still, frames and ear box are checked when the use case parses them into a job. */
export interface TrackHeadCommand {
	readonly still: string;
	readonly frames: readonly string[];
	readonly ear: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
	readonly values: HeadTrackConfig;
}
