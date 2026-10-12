// @aggregate the package entry re-exports the adapters the apps wire to the core's ports.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/infrastructure';
export { LocalRendererMfluxAdapter, type MfluxRenderConfig } from './adapter/Render/localRenderer-mflux.adapter.ts';
export { readMemory } from './adapter/Render/readMemory.ts';
export { RenderMachineLocalAdapter } from './adapter/Render/renderMachine-local.adapter.ts';
export { ClockSystemAdapter } from './adapter/Time/clock-system.adapter.ts';
