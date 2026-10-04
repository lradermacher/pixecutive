// referenceRenderer-qwen.adapter.ts — renders one reference with Qwen-Image-Edit on this Mac under a memory guard.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IReferenceRenderer } from '@pixecutive/core';
import { judgeMemory } from './judgeMemory.ts';
import { MemoryAction } from './memoryAction.enum.ts';
import type { MemoryReading } from './memoryReading.interface.ts';
import { renderLogRow } from './renderLogRow.ts';

/** Where and how the adapter renders; the app builds it from the pipeline's configuration. */
export interface QwenRenderConfig {
	readonly outputDir: string;
	readonly command: readonly string[];
	readonly model: string;
	readonly steps: number;
	readonly width: number;
	readonly height: number;
	readonly intervalMs: number;
	readonly readMemory: () => MemoryReading;
	readonly now: () => Date;
}

/**
 * One render at a time: a lock file refuses a second one, a start under memory pressure is refused, and a running
 * render is stopped at critical pressure or past the swap limit. Every render leaves one row in `renders.tsv`. The
 * command gets the prompt file, the input image, the seed and the output path appended.
 */
export class QwenReferenceRendererAdapter implements IReferenceRenderer {
	constructor(private readonly config: QwenRenderConfig) {}

	async render(
		input: string,
		prompt: string,
		seed: number,
	): Promise<{ readonly image: string | null; readonly problem: string }> {
		const { outputDir } = this.config;
		mkdirSync(outputDir, { recursive: true });
		const lock = join(outputDir, 'current.lock');
		if (existsSync(lock)) return { image: null, problem: `a render is running (${readFileSync(lock, 'utf8').trim()})` };
		const start = this.config.readMemory();
		const entry = judgeMemory(false, start.pressure, 0);
		if (entry.action !== MemoryAction.Go) return { image: null, problem: entry.reason };
		const name = `ref-${String(seed)}`;
		const promptFile = join(outputDir, `${name}.prompt.txt`);
		const image = join(outputDir, `${name}.png`);
		writeFileSync(promptFile, prompt);
		writeFileSync(lock, name);
		try {
			const outcome = await this.run(start, [...this.config.command, promptFile, input, String(seed), image]);
			const finished = outcome.result === 'done' && existsSync(image);
			appendFileSync(
				join(outputDir, 'renders.tsv'),
				`${renderLogRow({ ...outcome, at: this.config.now(), name, seed, model: this.config.model, steps: this.config.steps, size: `${String(this.config.width)}x${String(this.config.height)}`, result: finished ? 'done' : outcome.result === 'done' ? 'FAILED: no image' : outcome.result })}\n`,
			);
			return finished ? { image, problem: '' } : { image: null, problem: outcome.result };
		} finally {
			rmSync(lock, { force: true });
		}
	}

	private run(
		start: MemoryReading,
		argv: readonly string[],
	): Promise<{
		firstStepSeconds: number | null;
		totalSeconds: number;
		secondsPerStep: number | null;
		peakPressure: number;
		swapPeakMb: number;
		result: string;
	}> {
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
				const steps = [
					...chunk
						.toString()
						.replaceAll('\r', '\n')
						.matchAll(/ ([0-9]+)\/[0-9]+ \[[^\]]*\]/g),
				];
				const step = steps.at(-1);
				if (step === undefined) return;
				lastStep = step[0];
				if (firstStepAt === null && Number(step[1]) >= 1) firstStepAt = Date.now();
			};
			child.stdout.on('data', watchOutput);
			child.stderr.on('data', watchOutput);
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
