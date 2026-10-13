// figureExitCode.ts — the command line's answer to every failure of the motion chain: one exit code and one message
// per key.
import { FigureExceptionKey } from '@pixecutive/core';
import type { ExitAnswer } from './renderExitCode.ts';

/** Every key of `FigureExceptionKey` has its own row, so a new key fails the type check until it is answered here.
 * The render keys hold 3 to 11; the motion chain's start at 12. */
export const figureExitCode: Readonly<Record<FigureExceptionKey, ExitAnswer>> = Object.freeze({
	[FigureExceptionKey.InvalidConfig]: { code: 12, message: 'The motion chain configuration is incomplete' },
	[FigureExceptionKey.InvalidJob]: { code: 13, message: 'The figure job is invalid' },
	[FigureExceptionKey.MissingFrame]: { code: 14, message: 'A range reaches beyond the clip' },
	[FigureExceptionKey.Busy]: { code: 15, message: 'Another local model job is running' },
	[FigureExceptionKey.MemoryPressure]: { code: 16, message: 'The memory is under pressure; the clip did not start' },
	[FigureExceptionKey.MemoryUnreadable]: { code: 17, message: 'The memory cannot be read, so the guard cannot run' },
	[FigureExceptionKey.Aborted]: { code: 18, message: 'The memory guard stopped the clip' },
	[FigureExceptionKey.Interrupted]: { code: 19, message: 'The clip was interrupted' },
	[FigureExceptionKey.ClipFailed]: { code: 20, message: 'The video model failed' },
	[FigureExceptionKey.FramesFailed]: { code: 21, message: 'The clip could not be cut into sprites' },
	[FigureExceptionKey.TrackFailed]: { code: 22, message: 'The head could not be tracked' },
	[FigureExceptionKey.HeadDrift]: { code: 23, message: 'The ear strayed from the head; the face would slide' },
	[FigureExceptionKey.StorageFailed]: { code: 24, message: 'The renders or asset folder cannot be written or read' },
});
