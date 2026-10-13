// motionWork-files.adapter.ts — keeps the motion chain's work between its commands as JSON files in the renders folder:
// the cut sprites with their plan, and the head track; each read back is checked by the core's schemas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	type CutFrames,
	cutResultSchema,
	FigureException,
	FigureExceptionKey,
	type FigureName,
	framePlanSchema,
	type HeadTrack,
	headTrackSchema,
	type IMotionWork,
	type Motion,
} from '@pixecutive/core';

/**
 * Runs one step on the work folder and names a failure with the storage key.
 * @throws {FigureException} the storage key with the step and the file system's message.
 */
function onDisk<T>(what: string, step: () => T): T {
	try {
		return step();
	} catch (failure) {
		throw new FigureException(FigureExceptionKey.StorageFailed, `${what}: ${(failure as Error).message}`);
	}
}

/**
 * `<work>/<figure>-<motion>/cut.json` and `track.json`.
 * @throws {FigureException} the invalid job key when a step's file is missing (the command before has not run), the
 * storage key when a file cannot be written or read back as what it should hold.
 */
export class MotionWorkFilesAdapter implements IMotionWork {
	constructor(private readonly work: string) {}

	saveCut(figure: FigureName, motion: Motion, cut: CutFrames): Promise<void> {
		return this.write(figure, motion, 'cut', cut);
	}

	loadCut(figure: FigureName, motion: Motion): Promise<CutFrames> {
		return this.read(figure, motion, 'cut', 'frames', (json) => {
			const record = json as { plan?: unknown; result?: unknown };
			const plan = framePlanSchema.safeParse(record.plan);
			const result = cutResultSchema.safeParse(record.result);
			return plan.success && result.success ? { plan: plan.data, result: result.data } : null;
		});
	}

	saveTrack(figure: FigureName, motion: Motion, track: HeadTrack): Promise<void> {
		return this.write(figure, motion, 'track', track);
	}

	loadTrack(figure: FigureName, motion: Motion): Promise<HeadTrack> {
		return this.read(figure, motion, 'track', 'track', (json) => {
			const track = headTrackSchema.safeParse(json);
			return track.success ? track.data : null;
		});
	}

	private file(figure: FigureName, motion: Motion, name: string): string {
		return join(this.work, `${figure}-${motion}`, `${name}.json`);
	}

	private write(figure: FigureName, motion: Motion, name: string, data: unknown): Promise<void> {
		return new Promise((resolve) => {
			const file = this.file(figure, motion, name);
			onDisk(`write ${name}`, () => {
				mkdirSync(join(this.work, `${figure}-${motion}`), { recursive: true });
				writeFileSync(file, `${JSON.stringify(data, null, '\t')}\n`);
			});
			resolve();
		});
	}

	private read<T>(
		figure: FigureName,
		motion: Motion,
		name: string,
		before: string,
		check: (json: unknown) => T | null,
	): Promise<T> {
		// Inside the executor every failure becomes the promise's rejection.
		return new Promise((resolve) => {
			const file = this.file(figure, motion, name);
			if (!existsSync(file)) {
				throw new FigureException(
					FigureExceptionKey.InvalidJob,
					`no ${name} of ${figure} ${motion}: run \`pnpm assets ${before} ${figure} ${motion}\` first`,
				);
			}
			const checked = check(onDisk(`read ${name}`, () => JSON.parse(readFileSync(file, 'utf8')) as unknown));
			if (checked === null) throw new FigureException(FigureExceptionKey.StorageFailed, `${file} holds no ${name}`);
			resolve(checked);
		});
	}
}
