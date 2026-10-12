// localRenderer-mflux.adapter.ts — renders one image with mflux on this Mac, one job at a time, under a memory guard.
import { spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
	type IClock,
	type ILocalRenderer,
	type RenderJob,
	type RenderResult,
	type RenderStatus,
	RenderException,
	RenderExceptionKey,
} from '@pixecutive/core';
import { judgeMemory } from './judgeMemory.ts';
import { MemoryAction } from './memoryAction.enum.ts';
import type { MemoryReading } from './memoryReading.interface.ts';
import { renderLogRow } from './renderLogRow.ts';

/** Where mflux and its weights live, and how the guard reads the memory; the app builds it from its configuration. */
export interface MfluxRenderConfig {
	readonly rendersDir: string;
	readonly mflux: string;
	readonly lora: string;
	readonly intervalMs: number;
	readonly readMemory: () => MemoryReading;
	readonly clock: IClock;
	/** Where Ctrl-C and a closed terminal arrive; the process itself in production, a plain emitter in tests. */
	readonly interrupts: EventEmitter;
}

/** What one run of the model measured. */
interface RunOutcome {
	readonly firstStepSeconds: number | null;
	readonly totalSeconds: number;
	readonly secondsPerStep: number | null;
	readonly peakPressure: number;
	readonly swapPeakMb: number;
	readonly result: string;
}

/** The edit model and its eight-step Lightning LoRA, the settings every approved render of the figures used. */
const model = 'mlx-community/qwen-image-edit-2511-8bit';
const steps = 8;

/** How many log rows the status shows. */
const statusRows = 5;

/** The signals of Ctrl-C and of a closing terminal; either stops the render, which still writes its log row. */
const interruptSignals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const interrupted = 'ABORT: interrupted';
/** The result of a run stopped because the renders folder could not be written while mflux ran. */
const storagePrefix = 'STORAGE: ';

/**
 * Runs one step on the renders folder; whatever the file system answers leaves the adapter with the storage key.
 * @throws {RenderException} the storage key with the step and the file system's message.
 */
function onDisk<T>(what: string, step: () => T): T {
	try {
		return step();
	} catch (failure) {
		throw new RenderException(RenderExceptionKey.StorageFailed, `${what}: ${(failure as Error).message}`);
	}
}

/** One lock line: the IDs of this process and of mflux, then the running render. */
function lockLine(processIds: readonly number[], label: string): string {
	return `${processIds.join(',')}\t${label}`;
}

/** Whether a process of a lock still runs; an ID that is no positive integer belongs to no process. */
function isAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (failure) {
		return (failure as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/**
 * One render at a time: a lock file refuses a second one, a start under memory pressure is refused, and a running
 * render is stopped at critical pressure, past the swap limit or by an interrupt. The lock is created atomically and
 * carries the IDs of this process and of mflux, the running render and its step; a lock whose processes are all gone
 * is cleared. Every run leaves one row in `renders.tsv`.
 * @throws {RenderException} from `render`, with the key of the failure; never a plain error.
 */
export class LocalRendererMfluxAdapter implements ILocalRenderer {
	constructor(private readonly config: MfluxRenderConfig) {}

	/**
	 * Renders `job` into the renders folder and logs the run.
	 * @throws {RenderException} busy, memory pressure before the start, aborted by the guard, interrupted, or failed in mflux.
	 */
	async render(job: RenderJob): Promise<RenderResult> {
		const { rendersDir } = this.config;
		onDisk('create the renders folder', () => mkdirSync(rendersDir, { recursive: true }));
		const lock = join(rendersDir, 'current.lock');
		const running = this.running(lock);
		if (running !== null) throw new RenderException(RenderExceptionKey.Busy, `a render is running (${running})`);
		const start = this.memory();
		const entry = judgeMemory(false, start.pressure, 0);
		if (entry.action !== MemoryAction.Go) throw new RenderException(RenderExceptionKey.MemoryPressure, entry.reason);
		const base = basename(job.promptFile, '.txt');
		const name = `${base}-s${String(job.seed)}`;
		const image = join(rendersDir, `${name}.png`);
		// mflux writes beside the result, so an earlier image is replaced only by a finished run and never counts as one.
		const rendering = join(rendersDir, `${name}.rendering.png`);
		onDisk('remove an unfinished image of an earlier run', () => {
			rmSync(rendering, { force: true });
		});
		this.createLock(lock, lockLine([process.pid], name));
		try {
			const outcome = await this.run(start, this.argv(job, rendering), (progress, mfluxPid) => {
				onDisk('write the step into the lock', () => {
					writeFileSync(lock, lockLine([process.pid, mfluxPid], `${name} ${progress}`));
				});
			});
			const finished = outcome.result === 'done' && existsSync(rendering);
			const result = finished ? 'done' : outcome.result === 'done' ? 'FAILED: no image' : outcome.result;
			onDisk('append the log row', () => {
				appendFileSync(
					join(rendersDir, 'renders.tsv'),
					`${renderLogRow({ ...outcome, at: this.config.clock.now(), name: base, seed: job.seed, model, steps, size: `${String(job.width)}x${String(job.height)}`, result })}\n`,
				);
			});
			if (finished) {
				onDisk('move the image into place', () => {
					renameSync(rendering, image);
				});
				return { name, image };
			}
			const key =
				result === interrupted
					? RenderExceptionKey.Interrupted
					: result.startsWith(storagePrefix)
						? RenderExceptionKey.StorageFailed
						: result.startsWith('ABORT')
							? RenderExceptionKey.Aborted
							: RenderExceptionKey.Failed;
			throw new RenderException(key, result);
		} finally {
			onDisk('remove the lock', () => {
				rmSync(lock, { force: true });
			});
		}
	}

	status(): RenderStatus {
		const log = join(this.config.rendersDir, 'renders.tsv');
		const memory = this.memory();
		return {
			running: this.running(join(this.config.rendersDir, 'current.lock')),
			pressure: memory.pressure,
			swapMb: memory.swapMb,
			lastRows: existsSync(log)
				? onDisk('read the log', () => readFileSync(log, 'utf8'))
						.trim()
						.split('\n')
						.slice(-statusRows)
				: [],
		};
	}

	/**
	 * The machine's memory as the guard needs it.
	 * @throws {RenderException} the unreadable memory key, because a render without its guard must not start.
	 */
	private memory(): MemoryReading {
		try {
			return this.config.readMemory();
		} catch (failure) {
			throw new RenderException(RenderExceptionKey.MemoryUnreadable, (failure as Error).message);
		}
	}

	/**
	 * Creates `lock` only if no other render created it in the meantime.
	 * @throws {RenderException} busy when another render was quicker, the storage key when the lock cannot be written.
	 */
	private createLock(lock: string, line: string): void {
		try {
			writeFileSync(lock, line, { flag: 'wx' });
		} catch (failure) {
			if ((failure as NodeJS.ErrnoException).code === 'EEXIST') {
				throw new RenderException(RenderExceptionKey.Busy, 'another render took the lock first');
			}
			throw new RenderException(RenderExceptionKey.StorageFailed, `write the lock: ${(failure as Error).message}`);
		}
	}

	/** The running render named by `lock`, or null; a lock whose processes are all gone is removed. */
	private running(lock: string): string | null {
		if (!existsSync(lock)) return null;
		const [processIds = '', label = ''] = onDisk('read the lock', () => readFileSync(lock, 'utf8'))
			.trim()
			.split('\t');
		if (processIds.split(',').map(Number).some(isAlive)) return label;
		onDisk('clear a stale lock', () => {
			rmSync(lock, { force: true });
		});
		return null;
	}

	/** The mflux call for one job. */
	private argv(job: RenderJob, image: string): string[] {
		return [
			this.config.mflux,
			...['--model', model, '--base-model', 'qwen-image-edit'],
			...['--prompt-file', job.promptFile, '--image-paths', job.inputImage],
			...['--seed', String(job.seed), '--output', image, '--guidance', '1.0', '--steps', String(steps)],
			...['--lora-paths', this.config.lora, '--lora-scales', '1.0', '--no-bake-lora'],
			...['--width', String(job.width), '--height', String(job.height)],
			...['--vae-tiling', '--vae-tile-size', '256', '--mlx-cache-limit-gb', '4'],
		];
	}

	/** Runs mflux under the guard; `onStep` hears each new step as `n/total` with mflux's process ID, for the status. */
	private run(
		start: MemoryReading,
		argv: readonly string[],
		onStep: (progress: string, mfluxPid: number) => void,
	): Promise<RunOutcome> {
		const [binary = '', ...rest] = argv;
		const startedAt = Date.now();
		let firstStepAt: number | null = null;
		let lastStep = '';
		let peakPressure = start.pressure;
		let swapPeakMb = 0;
		let result = 'done';
		return new Promise((resolve) => {
			const child = spawn(binary, rest, { stdio: ['ignore', 'pipe', 'pipe'] });
			const watchOutput = (chunk: Buffer): void => {
				const step = [
					...chunk
						.toString()
						.replaceAll('\r', '\n')
						.matchAll(/ ([0-9]+)\/([0-9]+) \[[^\]]*\]/g),
				].at(-1);
				if (step === undefined) return;
				lastStep = step[0];
				// A listener's throw would never reach the render: a failed write stops mflux and ends the run instead.
				try {
					onStep(`${step[1] ?? ''}/${step[2] ?? ''}`, child.pid ?? 0);
				} catch (failure) {
					result = `${storagePrefix}${(failure as Error).message}`;
					child.kill('SIGTERM');
				}
				if (firstStepAt === null && Number(step[1]) >= 1) firstStepAt = Date.now();
			};
			child.stdout.on('data', watchOutput);
			child.stderr.on('data', watchOutput);
			child.on('error', (failure) => {
				result = `FAILED: ${failure.message}`;
			});
			// The first interrupt asks mflux to stop; a second one ends a model that ignores the first.
			const interrupt = (): void => {
				const again = result === interrupted;
				result = interrupted;
				child.kill(again ? 'SIGKILL' : 'SIGTERM');
			};
			for (const signal of interruptSignals) this.config.interrupts.on(signal, interrupt);
			const watch = setInterval(() => {
				let now: MemoryReading;
				try {
					now = this.config.readMemory();
				} catch {
					result = 'ABORT: the memory cannot be read';
					child.kill('SIGTERM');
					return;
				}
				peakPressure = Math.max(peakPressure, now.pressure);
				swapPeakMb = Math.max(swapPeakMb, now.swapMb - start.swapMb);
				const verdict = judgeMemory(true, now.pressure, now.swapMb - start.swapMb);
				if (verdict.action === MemoryAction.Abort) {
					result = `ABORT: ${verdict.reason}`;
					child.kill('SIGTERM');
				}
			}, this.config.intervalMs);
			child.on('close', (code) => {
				clearInterval(watch);
				for (const signal of interruptSignals) this.config.interrupts.off(signal, interrupt);
				if (result === 'done' && code !== 0) result = `FAILED: exit ${String(code)}`;
				const perStep = /([0-9.]+)s\/it/.exec(lastStep)?.[1];
				resolve({
					firstStepSeconds: firstStepAt === null ? null : Math.round((firstStepAt - startedAt) / 1000),
					totalSeconds: Math.round((Date.now() - startedAt) / 1000),
					secondsPerStep: perStep === undefined ? null : Number(perStep),
					peakPressure,
					swapPeakMb,
					result,
				});
			});
		});
	}
}
