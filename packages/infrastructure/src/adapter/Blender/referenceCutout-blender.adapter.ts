// referenceCutout-blender.adapter.ts — runs cutout.py in headless Blender and reads the paths it wrote.
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import type { IReferenceCutout } from '@pixecutive/core';

/** Blender is the one tool on this machine that reads and writes PNG with numpy at hand; the core never starts it. */
export class BlenderReferenceCutoutAdapter implements IReferenceCutout {
	constructor(private readonly blender: string) {}

	cut(image: string, panels: number, keyColor: string, outputDir: string): Promise<readonly string[]> {
		const script = join(import.meta.dirname, 'cutout.py');
		const argv = ['-b', '--factory-startup', '-P', script, '--', image, String(panels), keyColor, outputDir];
		return new Promise((resolve, reject) => {
			execFile(this.blender, argv, { maxBuffer: 16 * 1024 * 1024 }, (failure, stdout) => {
				const line = stdout.split('\n').find((entry) => entry.startsWith('CUTOUT '));
				if (failure !== null || line === undefined) {
					reject(failure ?? new Error(`cutout.py answered no CUTOUT line: ${stdout.slice(-400)}`));
					return;
				}
				const answer = JSON.parse(line.slice('CUTOUT '.length)) as {
					readonly written?: readonly string[];
					readonly error?: string;
				};
				if (answer.error !== undefined) reject(new Error(answer.error));
				else resolve(answer.written ?? []);
			});
		});
	}
}
