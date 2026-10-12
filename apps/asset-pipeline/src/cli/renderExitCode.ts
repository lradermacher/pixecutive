// renderExitCode.ts — the command line's answer to every render failure: one exit code and one message per key.
import { RenderExceptionKey } from '@pixecutive/core';

/** What the command line answers for one key. */
export interface ExitAnswer {
	readonly code: number;
	readonly message: string;
}

/**
 * Every key of `RenderExceptionKey` has its own row, so a new key fails the type check until it is answered here.
 * 0 is success, 1 an unexpected failure and 2 a usage error; the keys start at 3.
 */
export const renderExitCode: Readonly<Record<RenderExceptionKey, ExitAnswer>> = Object.freeze({
	[RenderExceptionKey.InvalidConfig]: { code: 3, message: 'The render configuration is incomplete' },
	[RenderExceptionKey.InvalidJob]: { code: 4, message: 'The render job is invalid' },
	[RenderExceptionKey.Busy]: { code: 5, message: 'Another render is running' },
	[RenderExceptionKey.MemoryPressure]: { code: 6, message: 'The memory is under pressure; the render did not start' },
	[RenderExceptionKey.Aborted]: { code: 7, message: 'The memory guard stopped the render' },
	[RenderExceptionKey.Failed]: { code: 8, message: 'The model failed' },
});
