import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runPythonStep } from './pythonStep.ts';

const project = resolve(import.meta.dirname, '../../..');
const env = { uv: 'uv', project };
const dirs: string[] = [];
/** A real Python start loads OpenCV; under a full parallel test run that takes longer than vitest's 5 s default. */
const PYTHON_START_MS = 30_000;

function script(body: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'pix-python-step-'));
	dirs.push(dir);
	const file = join(dir, 'step.py');
	writeFileSync(file, body);
	return file;
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('runPythonStep', () => {
	it(
		'runs a step in the pinned environment and answers its output',
		async () => {
			const answer = await runPythonStep(
				env,
				script(
					'import sys, json, cv2, numpy, PIL\nprint(json.dumps([cv2.__version__, numpy.__version__, PIL.__version__, sys.argv[1:]]))\n',
				),
				['a', 'b'],
			);
			expect([answer.code, JSON.parse(answer.stdout)]).toEqual([0, ['4.14.0', '2.2.6', '12.3.0', ['a', 'b']]]);
		},
		PYTHON_START_MS,
	);

	it(
		'answers the exit code and the complaint of a failing step',
		async () => {
			const answer = await runPythonStep(env, script('import sys\nsys.stderr.write("no frames")\nsys.exit(3)\n'), []);
			expect([answer.code, answer.stderr]).toEqual([3, 'no frames']);
		},
		PYTHON_START_MS,
	);

	it('answers code null with the reason when uv cannot start', async () => {
		const answer = await runPythonStep({ uv: join(tmpdir(), 'no-such-uv'), project }, script('print(1)\n'), []);
		expect(answer.code).toBeNull();
		expect(answer.stderr).toMatch(/ENOENT/);
	});
});
