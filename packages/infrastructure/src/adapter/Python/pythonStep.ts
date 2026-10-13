// pythonStep.ts — one pixel step of an adapter, run as a Python process in the infrastructure package's pinned
// environment (ADR 0019: Python only as an adapter's internals). The adapter reads the answer and names any failure
// with its own key.
import { spawn } from 'node:child_process';

/** What a Python step answered: its exit code (null when it never started), its output and its complaint. */
export interface PythonStepAnswer {
	code: number | null;
	stdout: string;
	stderr: string;
}

/** Where the pinned environment lives and which uv starts it. */
export interface PythonEnvironment {
	uv: string;
	project: string;
}

/** An adapter's Python script and the environment it runs in (passed in: a bundled app cannot find the script). */
export interface PythonScriptConfig {
	readonly python: PythonEnvironment;
	readonly script: string;
}

/**
 * Runs `script` with `args` through `uv run --frozen` in the project's locked environment and collects its answer;
 * a step that cannot start answers with code null and the reason as its complaint.
 */
export function runPythonStep(
	env: PythonEnvironment,
	script: string,
	args: readonly string[],
): Promise<PythonStepAnswer> {
	return new Promise((resolve) => {
		const out: Buffer[] = [];
		const err: Buffer[] = [];
		const child = spawn(env.uv, ['run', '--frozen', '--project', env.project, 'python', script, ...args], {
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
		child.on('error', (failure) => {
			resolve({ code: null, stdout: '', stderr: failure.message });
		});
		child.on('close', (code) => {
			resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') });
		});
	});
}
