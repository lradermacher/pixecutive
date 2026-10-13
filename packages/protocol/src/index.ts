// @aggregate the package entry re-exports the schemas every side validates against.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/protocol';
export { FacePart } from './facePart.enum.ts';
export { figureManifestSchema, type FigureManifest } from './figureManifest.schema.ts';
