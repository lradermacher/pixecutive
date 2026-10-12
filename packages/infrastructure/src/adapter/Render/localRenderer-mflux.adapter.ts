// localRenderer-mflux.adapter.ts — renders one image with mflux on this Mac, one job at a time, under a memory guard.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * One render at a time: a lock file refuses a second one, a start under memory pressure is refused, and a running
 * render is stopped at critical pressure or past the swap limit. Every run leaves one row in `renders.tsv`.
 * @throws {RenderException} from `render`, with the key of the failure; never a plain error.
 */
export class LocalRendererMfluxAdapter implements ILocalRenderer {
	constructor(private readonly config: MfluxRenderConfig) {}

	/**
	 * Renders `job` into the renders folder and logs the run.
	 * @throws {RenderException} busy, memory pressure before the start, aborted by the guard, or failed in mflux.
	 */
	async render(job: RenderJob): Promise<RenderResult> {
		const { rendersDir } = this.config;
		mkdirSync(rendersDir, { recursive: true });
		const lock = join(rendersDir, 'current.lock');
		if (existsSync(lock)) {
			throw new RenderException(RenderExceptionKey.Busy, `a render is running (${readFileSync(lock, 'utf8').trim()})`);
		}
		const start = this.config.readMemory();
		const entry = judgeMemory(false, start.pressure, 0);
		if (entry.action !== MemoryAction.Go) throw new RenderException(RenderExceptionKey.MemoryPressure, entry.reason);
		const base = basename(job.promptFile, '.txt');
		const name = `${base}-s${String(job.seed)}`;
		const image = join(rendersDir, `${name}.png`);
		writeFileSync(lock, name);
		try {
			const outcome = await this.run(start, this.argv(job, image));
			const finished = outcome.result === 'done' && existsSync(image);
			const result = finished ? 'done' : outcome.result === 'done' ? 'FAILED: no image' : outcome.result;
			appendFileSync(
				join(rendersDir, 'renders.tsv'),
				`${renderLogRow({ ...outcome, at: this.config.clock.now(), name: base, seed: job.seed, model, steps, size: `${String(job.width)}x${String(job.height)}`, result })}\n`,
			);
			if (finished) return { name, image };
			const key = result.startsWith('ABORT') ? RenderExceptionKey.Aborted : RenderExceptionKey.Failed;
			throw new RenderException(key, result);
		} finally {
			rmSync(lock, { force: true });
		}
	}

	status(): RenderStatus {
		const lock = join(this.config.rendersDir, 'current.lock');
		const log = join(this.config.rendersDir, 'renders.tsv');
		const memory = this.config.readMemory();
		return {
			running: existsSync(lock) ? readFileSync(lock, 'utf8').trim() : null,
			pressure: memory.pressure,
			swapMb: memory.swapMb,
			lastRows: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').slice(-statusRows) : [],
		};
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

	private run(start: MemoryReading, argv: readonly string[]): Promise<RunOutcome> {
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
						.matchAll(/ ([0-9]+)\/[0-9]+ \[[^\]]*\]/g),
				].at(-1);
				if (step === undefined) return;
				lastStep = step[0];
				if (firstStepAt === null && Number(step[1]) >= 1) firstStepAt = Date.now();
			};
			child.stdout.on('data', watchOutput);
			child.stderr.on('data', watchOutput);
			child.on('error', (failure) => {
				result = `FAILED: ${failure.message}`;
			});
			const watch = setInterval(() => {
				const now = this.config.readMemory();
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
