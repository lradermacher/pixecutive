// memory-action.ts — what a render is to do after a memory reading: start or go on, refuse the start, or stop.

/** The actions of the memory guard. */
export const memoryAction = Object.freeze({ go: 'go', refuse: 'refuse', abort: 'abort' } as const);

/** One action of the memory guard. */
export type MemoryAction = (typeof memoryAction)[keyof typeof memoryAction];
