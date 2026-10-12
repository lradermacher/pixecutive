// renderMachine-local.adapter.ts — this Mac's answers for a local render: the git root, mflux and the cached LoRA.
import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type IRenderMachine, RenderException, RenderExceptionKey } from '@pixecutive/core';

/** The Lightning LoRA's folder in a Hugging Face cache; its snapshot folder is named by a hash. */
const loraSnapshots = ['models--lightx2v--Qwen-Image-Edit-2511-Lightning', 'snapshots'];
const loraFile = 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors';

/**
 * Reads the machine for the render configuration; `home` is the user's home folder and `cwd` the folder git runs in,
 * the app's own folder unless a test names another. The weights are the Lightning LoRA, the command is mflux.
 * @throws {RenderException} with the invalid configuration key: from `repoRoot` outside a git repo, from
 * `cachedWeights` when the cache cannot be read.
 */
export class RenderMachineLocalAdapter implements IRenderMachine {
	constructor(
		private readonly home: string = homedir(),
		private readonly cwd?: string,
	) {}

	repoRoot(): string {
		try {
			// git's own complaint is caught with the failure, so it reaches the user once, inside the key's detail.
			const options: ExecFileSyncOptionsWithStringEncoding = {
				// Read inside the try: when the app's folder is gone there is no cwd, and that is a key too.
				cwd: this.cwd ?? process.cwd(),
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
			};
			return execFileSync('git', ['rev-parse', '--show-toplevel'], options).trim();
		} catch (failure) {
			throw new RenderException(RenderExceptionKey.InvalidConfig, `no git repo: ${(failure as Error).message}`);
		}
	}

	usualModelCommand(): string {
		return join(this.home, '.local', 'bin', 'mflux-generate-qwen-edit');
	}

	/**
	 * The LoRA in whichever snapshot folder holds it, in `cache` or in the usual Hugging Face cache of the home folder.
	 * @throws {RenderException} the invalid configuration key when the cache folder cannot be read.
	 */
	cachedWeights(cache: string = join(this.home, '.cache', 'huggingface', 'hub')): string | undefined {
		const snapshots = join(cache, ...loraSnapshots);
		if (!existsSync(snapshots)) return undefined;
		let folders: string[];
		try {
			folders = readdirSync(snapshots);
		} catch (failure) {
			throw new RenderException(RenderExceptionKey.InvalidConfig, `the LoRA cache: ${(failure as Error).message}`);
		}
		return folders.map((folder) => join(snapshots, folder, loraFile)).find((path) => existsSync(path));
	}

	isFile(path: string): boolean {
		// A folder, a missing path or one that cannot be read is no file to render with; asking never fails, so the start
		// can name every wrong path at once.
		try {
			return statSync(path).isFile();
		} catch {
			return false;
		}
	}
}
