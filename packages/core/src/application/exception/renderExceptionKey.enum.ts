// renderExceptionKey.enum.ts — stable keys for render failures; each edge translates them into its own answer.

/** Why a render did not start or did not finish. */
export enum RenderExceptionKey {
	InvalidConfig = 'render.invalid_config',
	InvalidJob = 'render.invalid_job',
	Busy = 'render.busy',
	MemoryPressure = 'render.memory_pressure',
	Aborted = 'render.aborted',
	Interrupted = 'render.interrupted',
	Failed = 'render.failed',
}
