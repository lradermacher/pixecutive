// exitAnswer.ts — what the command line answers for a failure: the table's row for a render key, 1 for anything else.
import { RenderException } from '@pixecutive/core';
import { type ExitAnswer, renderExitCode } from './renderExitCode.ts';

/** The exit code and the line for `failure`; a render failure names its key and what was measured. */
export function exitAnswer(failure: unknown): ExitAnswer {
	if (!(failure instanceof RenderException)) return { code: 1, message: String(failure) };
	const { code, message } = renderExitCode[failure.key];
	return { code, message: `${message} (${failure.key}): ${failure.detail}` };
}
