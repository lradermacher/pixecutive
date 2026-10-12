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
 * @throws {RenderException} from `repoRoot`, with the invalid configuration key, when the app runs outside a git repo.
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

	cachedLora(): string | undefined {
		const snapshots = join(this.home, ...loraSnapshots);
		const snapshot = existsSync(snapshots) ? readdirSync(snapshots)[0] : undefined;
		const path = snapshot === undefined ? undefined : join(snapshots, snapshot, loraFile);
		return path !== undefined && existsSync(path) ? path : undefined;
	}

	exists(path: string): boolean {
		return existsSync(path);
	}
}
