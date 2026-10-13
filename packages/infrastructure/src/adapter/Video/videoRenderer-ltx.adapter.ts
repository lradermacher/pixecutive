// videoRenderer-ltx.adapter.ts — renders one motion clip with the local LTX-2.3 video model (ltx-2-mlx), one job at
// a time, under the memory guard every local model shares.
import type { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	type ClipConfig,
	type ClipJob,
	ClipMode,
	type ClipResult,
	FigureException,
	FigureExceptionKey,
	type FigureName,
	type IVideoRenderer,
	type Motion,
} from '@pixecutive/core';
import { guardedRun } from '../Guard/guardedRun.ts';
import { judgeMemory } from '../Guard/judgeMemory.ts';
import { LocalJobLock } from '../Guard/localJobLock.ts';
import { LockFailure } from '../Guard/lockFailure.enum.ts';
import { MemoryAction } from '../Guard/memoryAction.enum.ts';
import type { MemoryReading } from '../Guard/memoryReading.interface.ts';
import { RunEnd } from '../Guard/runEnd.enum.ts';

/** The machine's clip settings plus how the guard reads the memory and where interrupts arrive. */
export interface LtxClipConfig extends ClipConfig {
	readonly intervalMs: number;
	readonly readMemory: () => MemoryReading;
	/** Where Ctrl-C and a closed terminal arrive; the process itself in production, a plain emitter in tests. */
	readonly interrupts: EventEmitter;
}

/** ltx-2-mlx reports each denoising stage as `n/total` on its error output, the way tqdm draws a bar. */
const denoising = /Denoising:\s+\d+%\|[^|]*\|\s*(\d+)\/(\d+)/;

/** How many of the model's last lines are kept to say why it failed. */
const complaintLines = 5;

/** The figure key for each end of a run that did not finish; a new end fails the type check until it has one. */
const endKey: Readonly<Record<Exclude<RunEnd, RunEnd.Done>, FigureExceptionKey>> = Object.freeze({
	[RunEnd.Aborted]: FigureExceptionKey.Aborted,
	[RunEnd.Interrupted]: FigureExceptionKey.Interrupted,
	[RunEnd.StorageFailed]: FigureExceptionKey.StorageFailed,
	[RunEnd.Failed]: FigureExceptionKey.ClipFailed,
});

/** The shared lock's failures as figure keys: another job is busy, or the renders folder failed. */
function nameLockFailure(failure: LockFailure, detail: string): FigureException {
	return new FigureException(
		failure === LockFailure.Busy ? FigureExceptionKey.Busy : FigureExceptionKey.StorageFailed,
		detail,
	);
}

/**
 * Runs one step on the renders folder and names a failure with the storage key.
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
 * One clip at a time: the lock it shares with the image renderer refuses a second job, a start under memory pressure
 * is refused, and a running clip is stopped at critical pressure, past the swap limit or by an interrupt. The model
 * writes beside the result, so only a finished run replaces an earlier clip.
 * @throws {FigureException} from `render`, with the key of the failure; never a plain error.
 */
export class VideoRendererLtxAdapter implements IVideoRenderer {
	constructor(private readonly config: LtxClipConfig) {}

	/** Where the clip of a figure's motion lies in a renders folder; the frames command reads it from there. */
	static clipOf(rendersDir: string, figure: FigureName, motion: Motion): string {
		return join(rendersDir, 'clips', `${figure}-${motion}.mp4`);
	}

	/**
	 * Renders `job` into `clips/<figure>-<motion>.mp4` of the renders folder.
	 * @throws {FigureException} invalid job for a missing input, busy, memory pressure before the start, memory
	 * unreadable, aborted by the guard, interrupted, storage failed, or clip failed in the model.
	 */
	async render(job: ClipJob): Promise<ClipResult> {
		const clip = VideoRendererLtxAdapter.clipOf(this.config.rendersDir, job.figure, job.motion);
		const clips = dirname(clip);
		onDisk('create the clips folder', () => mkdirSync(clips, { recursive: true }));
		for (const [what, path] of [
			['still', job.still],
			['prompt file', job.promptFile],
		] as const) {
			if (!existsSync(path)) throw new FigureException(FigureExceptionKey.InvalidJob, `${what} ${path} does not exist`);
		}
		const lock = new LocalJobLock(join(this.config.rendersDir, 'current.lock'), nameLockFailure);
		const running = lock.running();
		if (running !== null) throw new FigureException(FigureExceptionKey.Busy, `a job is running (${running})`);
		const start = this.memory();
		const entry = judgeMemory(false, start.pressure, 0);
		if (entry.action !== MemoryAction.Go) throw new FigureException(FigureExceptionKey.MemoryPressure, entry.reason);
		const name = `${job.figure}-${job.motion}`;
		const rendering = join(clips, `${name}.rendering.mp4`);
		const prompt =
			onDisk('read the prompt', () => readFileSync(job.promptFile, 'utf8').trim()) + this.config.promptSuffix;
		onDisk('remove an unfinished clip of an earlier run', () => {
			rmSync(rendering, { force: true });
		});
		lock.take(name);
		try {
			const end = await this.run(start, this.argv(job, prompt, rendering), (pid, progress) => {
				lock.update([process.pid, pid], progress === '' ? name : `${name} ${progress}`);
			});
			if (end.end !== RunEnd.Done) throw new FigureException(endKey[end.end], end.reason);
			if (!existsSync(rendering)) throw new FigureException(FigureExceptionKey.ClipFailed, 'the model wrote no clip');
			onDisk('move the clip into place', () => {
				renameSync(rendering, clip);
			});
			return { clip };
		} finally {
			// An unfinished clip must not lie beside the earlier one, where it would look like a result.
			onDisk('remove the unfinished clip', () => {
				rmSync(rendering, { force: true });
			});
			lock.release();
		}
	}

	/**
	 * The machine's memory as the guard needs it.
	 * @throws {FigureException} the unreadable memory key, because a clip without its guard must not start.
	 */
	private memory(): MemoryReading {
		try {
			return this.config.readMemory();
		} catch (failure) {
			throw new FigureException(FigureExceptionKey.MemoryUnreadable, (failure as Error).message);
		}
	}

	/** The ltx-2-mlx call for one job: a loop anchors its last frame on the same still, at the job's strength. */
	private argv(job: ClipJob, prompt: string, out: string): string[] {
		const { uv, ltxProject, model, frameRate, size } = this.config;
		const anchorEnd =
			job.mode === ClipMode.Loop ? ['--image', job.still, String(job.frames - 1), String(job.endStrength)] : [];
		return [
			uv,
			...['run', '--project', ltxProject, 'ltx-2-mlx', 'generate'],
			...['--model', model, '--distilled', '--low-ram', '--prompt', prompt],
			...['--image', job.still, '0', '1.0', ...anchorEnd],
			...['-f', String(job.frames), '--frame-rate', String(frameRate)],
			...['--width', String(size), '--height', String(size), '-o', out],
		];
	}

	/** Runs the model under the shared guard; its last lines say why it failed. */
	private run(
		start: MemoryReading,
		argv: readonly string[],
		mark: (pid: number, progress: string) => void,
	): ReturnType<typeof guardedRun> {
		const lines: string[] = [];
		return guardedRun(
			{
				argv,
				start,
				readMemory: this.config.readMemory,
				intervalMs: this.config.intervalMs,
				interrupts: this.config.interrupts,
			},
			{
				mark,
				step: (text) => {
					const found = text
						.split('\n')
						.map((line) => denoising.exec(line))
						.filter((hit) => hit !== null)
						.at(-1);
					return found ? { done: Number(found[1]), total: Number(found[2]), line: found[0] } : null;
				},
				listen: (chunk) => {
					for (const line of chunk.toString().replaceAll('\r', '\n').split('\n')) {
						if (line.trim() !== '' && !denoising.test(line)) lines.push(line.trim());
					}
					lines.splice(0, Math.max(0, lines.length - complaintLines));
				},
				complaint: () => lines.join(' | '),
				describe: (failure) => (failure instanceof FigureException ? failure.detail : String(failure)),
			},
		);
	}
}
