// pixelStep.ts — one call of the frame adapters' Python step, its answer checked by a core schema; whatever goes
// wrong becomes the frames-failed key.
import { FigureException, FigureExceptionKey } from '@pixecutive/core';
import { type PythonEnvironment, runPythonStep } from '../Python/pythonStep.ts';

/** What the step needs of a core schema: a check that answers the data or the issues. */
export interface AnswerSchema<T> {
	safeParse(
		data: unknown,
	):
		| { success: true; data: T }
		| { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } };
}

/**
 * Runs `script` with `args` and parses its standard output as JSON by `schema`.
 * @throws {FigureException} the frames-failed key when the step does not start, ends with an error, or answers
 * something the schema refuses.
 */
export async function pixelStep<T>(
	env: PythonEnvironment,
	script: string,
	args: readonly string[],
	schema: AnswerSchema<T>,
): Promise<T> {
	const answer = await runPythonStep(env, script, args);
	if (answer.code !== 0) {
		const ended = answer.code === null ? 'did not start' : `exit ${String(answer.code)}`;
		throw new FigureException(FigureExceptionKey.FramesFailed, `${ended}: ${answer.stderr.trim()}`);
	}
	let json: unknown;
	try {
		json = JSON.parse(answer.stdout);
	} catch {
		throw new FigureException(FigureExceptionKey.FramesFailed, `no JSON answer: ${answer.stdout.slice(0, 200)}`);
	}
	const parsed = schema.safeParse(json);
	if (!parsed.success) {
		throw new FigureException(
			FigureExceptionKey.FramesFailed,
			parsed.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`).join('; '),
		);
	}
	return parsed.data;
}
