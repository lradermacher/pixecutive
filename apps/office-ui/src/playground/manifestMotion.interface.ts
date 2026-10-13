// manifestMotion.interface.ts — one motion of one figure as the manifest describes it.
import type { FigureManifest } from '@pixecutive/protocol';

/** Frames with holds, sprite size, advance, head origins and face parts of one motion. */
export type ManifestMotion = FigureManifest['figures'][string]['motions'][string];
