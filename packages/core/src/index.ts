// @aggregate the package entry re-exports the core's public surface for the apps and adapters.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/core';
export type { IClock } from './port/outgoing/clock.interface.ts';
export type { IReferenceRenderer } from './port/outgoing/referenceRenderer.interface.ts';
