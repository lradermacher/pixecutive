// partCutter-opencv.adapter.ts — the head parts' pixel work with OpenCV in the pinned Python environment (`parts.py`):
// grids for the image model, the cuts of its drawings and the rows the lift is measured by.
import {
	FigureExceptionKey,
	type FitJob,
	type GlassesCutJob,
	type GridJob,
	type HatCutJob,
	type IPartCutter,
	type KeyCutJob,
	type PartCutResult,
	type SplitJob,
	type UnderHatJob,
	type VariantCutJob,
} from '@pixecutive/core';
import { type AnswerSchema, pixelStep } from '../Python/pixelStep.ts';
import type { PythonScriptConfig } from '../Python/pythonStep.ts';

/** An answer that is an object; the step's own fields are read by the method that asked. */
const answer: AnswerSchema<Record<string, unknown>> = {
	safeParse: (data) =>
		typeof data === 'object' && data !== null && !Array.isArray(data)
			? { success: true, data: data as Record<string, unknown> }
			: { success: false, error: { issues: [{ path: [], message: 'an object' }] } },
};

/** The cut's answer: how many pixels it kept, and the fit or the hide where it measured them. */
function cutResult(data: Record<string, unknown>): PartCutResult {
	const number = (key: string): number | undefined => (typeof data[key] === 'number' ? data[key] : undefined);
	const result: { -readonly [K in keyof PartCutResult]: PartCutResult[K] } = { pixels: number('pixels') ?? 0 };
	for (const key of ['scale', 'dx', 'dy', 'error', 'hide'] as const) {
		const value = number(key);
		if (value !== undefined) result[key] = value;
	}
	return result;
}

/**
 * Runs the pixel steps of the head parts, one process per call.
 * @throws {FigureException} the cut-failed key when a step fails or answers something else.
 */
export class PartCutterOpencvAdapter implements IPartCutter {
	constructor(private readonly config: PythonScriptConfig) {}

	private step(command: string, job: object): Promise<Record<string, unknown>> {
		return pixelStep(
			this.config.python,
			this.config.script,
			[command, JSON.stringify(job)],
			answer,
			FigureExceptionKey.CutFailed,
		);
	}

	async grid(job: GridJob): Promise<void> {
		await this.step('grid', job);
	}

	async split(job: SplitJob): Promise<void> {
		await this.step('split', job);
	}

	async keyCut(job: KeyCutJob): Promise<PartCutResult> {
		return cutResult(await this.step('key_cut', job));
	}

	async hatCut(job: HatCutJob): Promise<PartCutResult> {
		return cutResult(await this.step('hat_cut', job));
	}

	async glassesCut(job: GlassesCutJob): Promise<PartCutResult> {
		return cutResult(await this.step('glasses_cut', job));
	}

	async variantCut(job: VariantCutJob): Promise<PartCutResult> {
		return cutResult(await this.step('variant_cut', job));
	}

	async underHat(job: UnderHatJob): Promise<void> {
		await this.step('under_hat', job);
	}

	async fit(job: FitJob): Promise<void> {
		await this.step('fit', job);
	}

	async skullTop(open: string, threshold: number): Promise<number> {
		const row = (await this.step('skull', { open, threshold }))['row'];
		return typeof row === 'number' ? row : 0;
	}

	async firstRows(layers: readonly string[]): Promise<(number | null)[]> {
		const rows = (await this.step('first_rows', { layers }))['rows'];
		return Array.isArray(rows)
			? rows.map((row: unknown) => (typeof row === 'number' ? row : null))
			: layers.map(() => null);
	}
}
