// @aggregate the package entry re-exports the core's public surface for the apps and adapters.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/core';
export { renderConfigSchema, type RenderConfig } from './domain/Render/renderConfig.schema.ts';
export { renderJobSchema, type RenderJob } from './domain/Render/renderJob.schema.ts';
export type { RenderResult } from './domain/Render/renderResult.interface.ts';
export type { RenderStatus } from './domain/Render/renderStatus.interface.ts';
export { RenderException } from './application/exception/render.exception.ts';
export { RenderExceptionKey } from './application/exception/renderExceptionKey.enum.ts';
export { RenderImageService } from './application/service/renderImage.service.ts';
export type { RenderImageCommand } from './application/service/renderImageCommand.ts';
export type { IClock } from './port/outgoing/clock.interface.ts';
export type { ILocalRenderer } from './port/outgoing/localRenderer.interface.ts';
export type { IRenderMachine } from './port/outgoing/renderMachine.interface.ts';
