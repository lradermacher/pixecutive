// imageEditor.interface.ts — the image model that draws a part onto one of our templates.
import type { ImageEditJob } from '../../domain/Figure/imageEditJob.interface.ts';

/** The image editor: one drawing per call, written to the job's output; rejects with a `FigureException`. */
export interface IImageEditor {
	edit(job: ImageEditJob): Promise<void>;
}
