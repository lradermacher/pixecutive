import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pipelineConfig } from './pipelineConfig.ts';

describe('pipelineConfig', () => {
	it('places the renders in the repo by default', () => {
		const config = pipelineConfig({}, '/repo');
		expect(config.rendersDir).toBe(join('/repo', 'renders'));
		expect(config.lora).toMatch(/Qwen-Image-Edit-2511-Lightning-8steps-V1\.0-bf16\.safetensors$/);
	});

	it('lets the environment override every machine path', () => {
		const config = pipelineConfig({ PIX_RENDERS_DIR: '/tmp/r', PIX_MFLUX: '/m', PIX_LORA: '/l' }, '/repo');
		expect([config.rendersDir, config.mflux, config.lora]).toEqual(['/tmp/r', '/m', '/l']);
	});
});
