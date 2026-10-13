import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cutResultSchema, FigureException, FigureExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { pixelStep } from './pixelStep.ts';

const env = { uv: 'uv', project: resolve(import.meta.dirname, '../../..') };
/** A real Python start loads its environment; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;

/** A Python step with `body` as its script. */
function step(body: string): string {
	const path = join(mkdtempSync(join(tmpdir(), 'pixel-step-')), 'step.py');
	writeFileSync(path, body);
	return path;
}

async function failure(run: Promise<unknown>): Promise<[FigureExceptionKey, string] | null> {
	const error: unknown = await run.then(
		() => null,
		(caught: unknown) => caught,
	);
	return error instanceof FigureException ? [error.key, error.detail] : null;
}

describe('pixelStep', () => {
	it(
		'answers the parsed JSON of a step that succeeds',
		async () => {
			const answer = { frames: ['00.png'], scale: 0.5, width: 10, height: 20 };
			const script = step(`import json\nprint(json.dumps(${JSON.stringify(answer)}))\n`);
			expect(await pixelStep(env, script, [], cutResultSchema)).toEqual(answer);
		},
		PYTHON_START_MS,
	);

	it(
		'names a failing step with the frames-failed key, its exit code and its complaint',
		async () => {
			const script = step('import sys\nsys.stderr.write("no frames in x.mp4")\nsys.exit(2)\n');
			expect(await failure(pixelStep(env, script, [], cutResultSchema))).toEqual([
				FigureExceptionKey.FramesFailed,
				'exit 2: no frames in x.mp4',
			]);
		},
		PYTHON_START_MS,
	);

	it(
		'names an answer that is no JSON',
		async () => {
			const result = await failure(pixelStep(env, step('print("done")\n'), [], cutResultSchema));
			expect(result).toEqual([FigureExceptionKey.FramesFailed, 'no JSON answer: done\n']);
		},
		PYTHON_START_MS,
	);

	it(
		'names the field of an answer the schema refuses',
		async () => {
			const script = step('import json\nprint(json.dumps({"frames": [], "scale": 1, "width": 1, "height": 1}))\n');
			const result = await failure(pixelStep(env, script, [], cutResultSchema));
			expect(result?.[0]).toBe(FigureExceptionKey.FramesFailed);
			expect(result?.[1]).toMatch(/^frames: /);
		},
		PYTHON_START_MS,
	);

	it('names a step that cannot start', async () => {
		const result = await failure(pixelStep({ ...env, uv: join(tmpdir(), 'no-uv') }, step(''), [], cutResultSchema));
		expect(result?.[1]).toMatch(/^did not start: .*ENOENT/);
	});
});
