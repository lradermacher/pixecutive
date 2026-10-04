// memoryAction.enum.ts — what a render is to do after a memory reading.

/** Start or go on, refuse the start, or stop the running render. */
export enum MemoryAction {
	Go = 'go',
	Refuse = 'refuse',
	Abort = 'abort',
}
