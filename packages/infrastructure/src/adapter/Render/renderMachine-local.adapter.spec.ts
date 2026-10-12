import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RenderMachineLocalAdapter } from './renderMachine-local.adapter.ts';

const snapshots = ['.cache', 'huggingface', 'hub', 'models--lightx2v--Qwen-Image-Edit-2511-Lightning', 'snapshots'];

describe('RenderMachineLocalAdapter', () => {
	it('finds the LoRA in the snapshot folder of the cache', () => {
		const home = mkdtempSync(join(tmpdir(), 'home-'));
		const folder = join(home, ...snapshots, 'a1b2');
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors'), '');
		expect(new RenderMachineLocalAdapter(home).cachedLora()).toBe(
			join(folder, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors'),
		);
	});

	it('answers no LoRA when the cache holds none', () => {
		expect(new RenderMachineLocalAdapter(mkdtempSync(join(tmpdir(), 'home-'))).cachedLora()).toBeUndefined();
	});

	it('places the usual mflux in the home folder', () => {
		expect(new RenderMachineLocalAdapter('/opt/someone').usualMflux()).toBe(
			'/opt/someone/.local/bin/mflux-generate-qwen-edit',
		);
	});

	it('answers the root of the repo it runs in and whether a file exists', () => {
		const machine = new RenderMachineLocalAdapter();
		const root = machine.repoRoot();
		expect([machine.exists(join(root, 'package.json')), machine.exists(join(root, 'no-such-file'))]).toEqual([
			true,
			false,
		]);
	});
});
