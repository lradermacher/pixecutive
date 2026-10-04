// @aggregate the package entry re-exports the core's public surface for the apps and adapters.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/core';
export { Animation } from './domain/asset/animation.ts';
export type { CharacterSpec, Feature } from './domain/asset/character-spec.ts';
export type { DesignChoice, DesignLine } from './domain/asset/design-line.ts';
export type { ErrorType } from './domain/asset/error-type.ts';
export { FeatureCheck } from './domain/asset/feature-check.ts';
export { Joint } from './domain/asset/joint.ts';
export type { ReferenceTemplate } from './domain/asset/reference-template.ts';
export type { Verdict } from './domain/asset/verdict.ts';
export { View } from './domain/asset/view.ts';
export { AssetErrorKey } from './application/exception/asset-error-key.ts';
export { AssetException } from './application/exception/asset-exception.ts';
export { buildReferencePrompt } from './application/service/build-reference-prompt.ts';
export { developReference } from './application/service/develop-reference.ts';
export { parseCharacterSpec } from './application/service/parse-character-spec.ts';
export { parseDesignLine } from './application/service/parse-design-line.ts';
export { parseErrorTypes } from './application/service/parse-error-types.ts';
export { parseReferenceTemplate } from './application/service/parse-reference-template.ts';
export type { IClock } from './port/outgoing/clock.interface.ts';
export type { IReferenceRenderer } from './port/outgoing/reference-renderer.interface.ts';
export type { IVerdictLog } from './port/outgoing/verdict-log.interface.ts';
export type { IVisionChecker } from './port/outgoing/vision-checker.interface.ts';
