// @aggregate the package entry re-exports the adapters the apps wire to the core's ports.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/infrastructure';
export { LocalRendererMfluxAdapter, type MfluxRenderConfig } from './adapter/Render/localRenderer-mflux.adapter.ts';
export { readMemory } from './adapter/Guard/readMemory.ts';
export { RenderMachineLocalAdapter } from './adapter/Render/renderMachine-local.adapter.ts';
export { VideoRendererLtxAdapter, type LtxClipConfig } from './adapter/Video/videoRenderer-ltx.adapter.ts';
export { FrameCutterOpencvAdapter } from './adapter/Frames/frameCutter-opencv.adapter.ts';
export { FrameMeasurerOpencvAdapter } from './adapter/Frames/frameMeasurer-opencv.adapter.ts';
export { HeadTrackerOpencvAdapter } from './adapter/Head/headTracker-opencv.adapter.ts';
export type { PythonEnvironment, PythonScriptConfig } from './adapter/Python/pythonStep.ts';
export { AssetStoreFilesAdapter, type AssetStoreConfig } from './adapter/Asset/assetStore-files.adapter.ts';
