// @aggregate the package entry re-exports the core's public surface for the apps and adapters.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/core';
export { Animation } from './domain/Asset/animation.enum.ts';
export { characterSpecSchema, type CharacterSpec, type Feature } from './domain/Asset/characterSpec.schema.ts';
export { designLineSchema, type DesignChoice, type DesignLine } from './domain/Asset/designLine.schema.ts';
export { errorTypesSchema, type ErrorType } from './domain/Asset/errorType.schema.ts';
export { FeatureCheck } from './domain/Asset/featureCheck.enum.ts';
export { Joint } from './domain/Asset/joint.enum.ts';
export { referenceTemplateSchema, type ReferenceTemplate } from './domain/Asset/referenceTemplate.schema.ts';
export type { Verdict } from './domain/Asset/verdict.interface.ts';
export { View } from './domain/Asset/view.enum.ts';
export { AssetException } from './application/exception/asset.exception.ts';
export { AssetExceptionKey } from './application/exception/assetExceptionKey.enum.ts';
export { ReferenceDevelopmentService } from './application/service/referenceDevelopment.service.ts';
export { ReferencePromptService } from './application/service/referencePrompt.service.ts';
export type { IClock } from './port/outgoing/clock.interface.ts';
export type { IReferenceRenderer } from './port/outgoing/referenceRenderer.interface.ts';
export type { IVerdictLog } from './port/outgoing/verdictLog.interface.ts';
export type { IVisionChecker } from './port/outgoing/visionChecker.interface.ts';
