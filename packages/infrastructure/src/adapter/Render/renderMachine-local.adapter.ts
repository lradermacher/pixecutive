// renderMachine-local.adapter.ts — this Mac's answers for a local render: the git root, mflux and the cached LoRA.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type IRenderMachine, RenderException, RenderExceptionKey } from '@pixecutive/core';

/** The Lightning LoRA's folder in the Hugging Face cache; its snapshot folder is named by a hash. */
const loraSnapshots = ['.cache', 'huggingface', 'hub', 'models--lightx2v--Qwen-Image-Edit-2511-Lightning', 'snapshots'];
const loraFile = 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors';

/**
 * Reads the machine for the render configuration; `home` is the user's home folder and is replaced in tests.
 * @throws {RenderException} with the invalid configuration key: from `repoRoot` outside a git repo, from `cachedLora`
 * when the cache cannot be read.
 */
export class RenderMachineLocalAdapter implements IRenderMachine {
	constructor(private readonly home: string = homedir()) {}

	repoRoot(): string {
		try {
			return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
		} catch (failure) {
			throw new RenderException(RenderExceptionKey.InvalidConfig, `no git repo: ${(failure as Error).message}`);
		}
	}

	usualMflux(): string {
		return join(this.home, '.local', 'bin', 'mflux-generate-qwen-edit');
	}

	/**
	 * The LoRA in whichever snapshot folder holds it; none when the cache holds it nowhere.
	 * @throws {RenderException} the invalid configuration key when the cache folder cannot be read.
	 */
	cachedLora(): string | undefined {
		const snapshots = join(this.home, ...loraSnapshots);
		if (!existsSync(snapshots)) return undefined;
		let folders: string[];
		try {
			folders = readdirSync(snapshots);
		} catch (failure) {
			throw new RenderException(RenderExceptionKey.InvalidConfig, `the LoRA cache: ${(failure as Error).message}`);
		}
		return folders.map((folder) => join(snapshots, folder, loraFile)).find((path) => existsSync(path));
	}

	exists(path: string): boolean {
		return existsSync(path);
	}
}
