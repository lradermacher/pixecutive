// renderClip.service.ts — the use case "render one motion clip": checks the job, then hands it to the video renderer.
import { clipJobSchema } from '../../domain/Figure/clipJob.schema.ts';
import type { ClipResult } from '../../domain/Figure/clipResult.interface.ts';
import type { IVideoRenderer } from '../../port/outgoing/videoRenderer.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import type { RenderClipCommand } from './renderClipCommand.ts';

/** Renders one motion clip; a job the video model cannot take never reaches it. */
export class RenderClipService {
	constructor(private readonly renderer: IVideoRenderer) {}

	/**
	 * Parses `command` into a clip job; the renderer starts only for a valid job.
	 * @throws {FigureException} the invalid job key, naming every wrong field, before the model starts.
	 */
	render(command: RenderClipCommand): Promise<ClipResult> {
		const parsed = clipJobSchema.safeParse(command);
		if (!parsed.success) {
			return Promise.reject(
				new FigureException(
					FigureExceptionKey.InvalidJob,
					parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
				),
			);
		}
		return this.renderer.render(parsed.data);
	}
}
