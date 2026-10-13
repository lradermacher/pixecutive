// figureExceptionKey.enum.ts — stable keys for failures of the motion chain; each edge translates them into its own
// answer.

/** Why a clip, its frames, its head track, a drawing or an export did not come about. */
export enum FigureExceptionKey {
	InvalidConfig = 'figure.invalid_config',
	InvalidJob = 'figure.invalid_job',
	MissingFrame = 'figure.missing_frame',
	Busy = 'figure.busy',
	MemoryPressure = 'figure.memory_pressure',
	MemoryUnreadable = 'figure.memory_unreadable',
	Aborted = 'figure.aborted',
	Interrupted = 'figure.interrupted',
	ClipFailed = 'figure.clip_failed',
	FramesFailed = 'figure.frames_failed',
	TrackFailed = 'figure.track_failed',
	HeadDrift = 'figure.head_drift',
	StorageFailed = 'figure.storage_failed',
	DrawFailed = 'figure.draw_failed',
	DrawQuota = 'figure.draw_quota',
}
