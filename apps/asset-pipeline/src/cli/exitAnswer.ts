// exitAnswer.ts — what the command line answers for a failure: the table's row for a render or figure key, 1 for
// anything else.
import { FigureException, RenderException } from '@pixecutive/core';
import { figureExitCode } from './figureExitCode.ts';
import { type ExitAnswer, renderExitCode } from './renderExitCode.ts';

/** The exit code and the line for `failure`; a keyed failure names its key and what was measured. */
export function exitAnswer(failure: unknown): ExitAnswer {
	if (failure instanceof RenderException) {
		const { code, message } = renderExitCode[failure.key];
		return { code, message: `${message} (${failure.key}): ${failure.detail}` };
	}
	if (failure instanceof FigureException) {
		const { code, message } = figureExitCode[failure.key];
		return { code, message: `${message} (${failure.key}): ${failure.detail}` };
	}
	return { code: 1, message: String(failure) };
}
