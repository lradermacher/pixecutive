// imageEditJob.interface.ts — one drawing the image model makes from one of our images: what it edits, what it is
// asked, and where the result lands.

/** Edit `input` as `prompt` says; the result is the PNG at `output`. */
export interface ImageEditJob {
	readonly input: string;
	readonly prompt: string;
	readonly output: string;
}
