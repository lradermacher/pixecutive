// verdictLog.interface.ts — keeps every verdict of the reference check.
import type { Verdict } from '../../domain/Asset/verdict.interface.ts';

/** Appends one verdict to the log. */
export interface IVerdictLog {
	append(verdict: Verdict): Promise<void>;
}
