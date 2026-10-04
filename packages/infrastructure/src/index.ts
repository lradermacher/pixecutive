// @aggregate the package entry re-exports the adapters the apps wire to the core's ports.

/** The name under which this package is published in the workspace. */
export const packageName: string = '@pixecutive/infrastructure';
export { BlenderReferenceCutoutAdapter } from './adapter/Blender/referenceCutout-blender.adapter.ts';
export { JsonlVerdictLogAdapter } from './adapter/Log/verdictLog-jsonl.adapter.ts';
export { readMemory } from './adapter/Render/readMemory.ts';
export {
	QwenReferenceRendererAdapter,
	type QwenRenderConfig,
} from './adapter/Render/referenceRenderer-qwen.adapter.ts';
export { SystemClockAdapter } from './adapter/Time/systemClock.adapter.ts';
export { OllamaVisionCheckerAdapter } from './adapter/Vision/visionChecker-ollama.adapter.ts';
