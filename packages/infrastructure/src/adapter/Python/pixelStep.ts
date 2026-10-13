// pixelStep.ts — one call of an adapter's Python step, its answer checked by a core schema; whatever goes wrong
// becomes the calling adapter's failure key.
import { FigureException, type FigureExceptionKey } from '@pixecutive/core';
import { type PythonEnvironment, runPythonStep } from './pythonStep.ts';

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
 * @throws {FigureException} with `key` when the step does not start, is killed, ends with an error, or answers
 * something the schema refuses.
 */
export async function pixelStep<T>(
	env: PythonEnvironment,
	script: string,
	args: readonly string[],
	schema: AnswerSchema<T>,
	key: FigureExceptionKey,
): Promise<T> {
	const answer = await runPythonStep(env, script, args);
	if (answer.code !== 0) {
		const ended =
			answer.code !== null
				? `exit ${String(answer.code)}`
				: answer.signal !== null
					? `killed by ${answer.signal}`
					: 'did not start';
		throw new FigureException(key, `${ended}: ${answer.stderr.trim()}`);
	}
	let json: unknown;
	try {
		json = JSON.parse(answer.stdout);
	} catch {
		throw new FigureException(key, `no JSON answer: ${answer.stdout.slice(0, 200)}`);
	}
	const parsed = schema.safeParse(json);
	if (!parsed.success) {
		throw new FigureException(
			key,
			parsed.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`).join('; '),
		);
	}
	return parsed.data;
}
