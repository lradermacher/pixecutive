// verdictLog-jsonl.adapter.ts — appends every verdict as one JSON line, so the log stays readable and append-only.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IVerdictLog, Verdict } from '@pixecutive/core';

/** Writes verdicts to `file`, one per line, with the time as an ISO string. */
export class JsonlVerdictLogAdapter implements IVerdictLog {
	constructor(private readonly file: string) {}

	append(verdict: Verdict): Promise<void> {
		mkdirSync(dirname(this.file), { recursive: true });
		appendFileSync(this.file, `${JSON.stringify({ ...verdict, at: verdict.at.toISOString() })}\n`);
		return Promise.resolve();
	}
}
