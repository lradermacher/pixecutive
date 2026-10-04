import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pipelineConfig } from './pipelineConfig.ts';

describe('pipelineConfig', () => {
	it('places data and renders in the repo by default', () => {
		const config = pipelineConfig({}, '/repo');
		expect(config.dataDir).toBe(join('/repo', 'apps', 'asset-pipeline', 'data'));
		expect(config.rendersDir).toBe(join('/repo', 'renders'));
		expect(config.blenderScripts).toBe(join('/repo', 'packages', 'infrastructure', 'src', 'adapter', 'Blender'));
		expect(config.lora).toMatch(/Qwen-Image-Edit-2511-Lightning-8steps-V1\.0-bf16\.safetensors$/);
	});

	it('lets the environment override every machine path', () => {
		const config = pipelineConfig(
			{ PIX_RENDERS_DIR: '/tmp/r', PIX_BLENDER: '/b', PIX_VISION_MODEL: 'qwen3-vl:4b' },
			'/repo',
		);
		expect([config.rendersDir, config.blender, config.visionModel]).toEqual(['/tmp/r', '/b', 'qwen3-vl:4b']);
	});
});
