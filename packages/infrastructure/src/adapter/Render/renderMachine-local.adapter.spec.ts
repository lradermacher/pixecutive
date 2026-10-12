import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RenderException } from '@pixecutive/core';
import { describe, expect, it, vi } from 'vitest';
import { RenderMachineLocalAdapter } from './renderMachine-local.adapter.ts';

const snapshots = ['.cache', 'huggingface', 'hub', 'models--lightx2v--Qwen-Image-Edit-2511-Lightning', 'snapshots'];
const loraFile = 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors';

describe('RenderMachineLocalAdapter', () => {
	it('finds the LoRA in the snapshot folder of the cache', () => {
		const home = mkdtempSync(join(tmpdir(), 'home-'));
		const folder = join(home, ...snapshots, 'a1b2');
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors'), '');
		expect(new RenderMachineLocalAdapter(home).cachedWeights()).toBe(
			join(folder, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors'),
		);
	});

	it('finds the LoRA in a later snapshot folder when an earlier one lacks it', () => {
		const home = mkdtempSync(join(tmpdir(), 'home-'));
		mkdirSync(join(home, ...snapshots, 'a-first'), { recursive: true });
		const second = join(home, ...snapshots, 'b-second');
		mkdirSync(second, { recursive: true });
		writeFileSync(join(second, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors'), '');
		expect(new RenderMachineLocalAdapter(home).cachedWeights()).toBe(
			join(second, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors'),
		);
	});

	it('answers the invalid configuration key when the cache folder is a file', () => {
		const home = mkdtempSync(join(tmpdir(), 'home-'));
		mkdirSync(join(home, ...snapshots.slice(0, -1)), { recursive: true });
		writeFileSync(join(home, ...snapshots), 'not a folder');
		expect(() => new RenderMachineLocalAdapter(home).cachedWeights()).toThrow(RenderException);
	});

	it('looks in a cache folder it is given instead of the usual one', () => {
		const cache = mkdtempSync(join(tmpdir(), 'cache-'));
		const folder = join(cache, ...snapshots.slice(3), 'c3');
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, loraFile), '');
		expect(new RenderMachineLocalAdapter('/opt/someone').cachedWeights(cache)).toBe(join(folder, loraFile));
	});

	it('answers no LoRA when the cache holds none', () => {
		expect(new RenderMachineLocalAdapter(mkdtempSync(join(tmpdir(), 'home-'))).cachedWeights()).toBeUndefined();
	});

	it('places the usual mflux in the home folder', () => {
		expect(new RenderMachineLocalAdapter('/opt/someone').usualModelCommand()).toBe(
			'/opt/someone/.local/bin/mflux-generate-qwen-edit',
		);
	});

	it('answers the invalid configuration key with the complaint of git outside a repo', () => {
		const outside = new RenderMachineLocalAdapter('/opt/someone', mkdtempSync(join(tmpdir(), 'no-repo-')));
		expect(() => outside.repoRoot()).toThrow(/not a git repository/);
	});

	it('answers the invalid configuration key when the folder git runs in does not exist', () => {
		const gone = join(mkdtempSync(join(tmpdir(), 'gone-')), 'removed');
		expect(() => new RenderMachineLocalAdapter('/opt/someone', gone).repoRoot()).toThrow(RenderException);
	});

	it('reads its working folder only inside the keyed try', () => {
		const machine = new RenderMachineLocalAdapter('/opt/someone');
		const cwd = vi.spyOn(process, 'cwd').mockImplementation(() => {
			throw new TypeError('uv_cwd: no such file or directory');
		});
		try {
			expect(() => machine.repoRoot()).toThrow(RenderException);
		} finally {
			cwd.mockRestore();
		}
	});

	it('answers no file for a path in a folder it cannot read, without failing', () => {
		const locked = mkdtempSync(join(tmpdir(), 'locked-'));
		writeFileSync(join(locked, 'weights.safetensors'), '');
		chmodSync(locked, 0o000);
		try {
			expect(new RenderMachineLocalAdapter('/opt/someone').isFile(join(locked, 'weights.safetensors'))).toBe(false);
		} finally {
			chmodSync(locked, 0o700);
		}
	});

	it('answers the root of the repo it runs in and whether a path is a file', () => {
		const machine = new RenderMachineLocalAdapter();
		const root = machine.repoRoot();
		expect([
			machine.isFile(join(root, 'package.json')),
			machine.isFile(join(root, 'no-such-file')),
			machine.isFile(join(root, 'packages')),
		]).toEqual([true, false, false]);
	});
});
