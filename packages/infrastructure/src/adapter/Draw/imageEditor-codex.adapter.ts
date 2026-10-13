// imageEditor-codex.adapter.ts — draws through the local Codex CLI's image generation (Astra): it hands the CLI our
// template and the prompt, the model saves the drawing beside the output, and a missing file is a failure.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { FigureException, FigureExceptionKey, type IImageEditor, type ImageEditJob } from '@pixecutive/core';

/** The CLI's own words when the account's image quota is used up. */
const quota = /rate limit|usage limit|limit reached|quota/i;

/** The prompt the model gets: edit the attached image as asked, save it under the output's name, answer only that. */
function framed(job: ImageEditJob): string {
	const name = basename(job.output);
	return (
		`Use your image generation tool to edit the attached image. ${job.prompt.trim()} ` +
		`Save the resulting image as the file ${name} in the current directory and reply only with its file name.`
	);
}

/**
 * Draws one image per call through `codex exec`, in the output's folder, one call at a time.
 * @throws {FigureException} the draw-quota key when the CLI says the quota is used up, the draw-failed key when no
 * drawing arrived.
 */
export class ImageEditorCodexAdapter implements IImageEditor {
	constructor(private readonly binary: string) {}

	/** Has the model draw `job` and resolves once its drawing is at `job.output`. */
	edit(job: ImageEditJob): Promise<void> {
		const folder = dirname(job.output);
		const reply = `${job.output}.reply.txt`;
		const args = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '-C', folder];
		return new Promise((resolve, reject) => {
			// codex starts in the output's folder, which a first drawing of a kind has not made yet
			try {
				mkdirSync(folder, { recursive: true });
			} catch (failure) {
				reject(new FigureException(FigureExceptionKey.DrawFailed, `${folder}: ${(failure as Error).message}`));
				return;
			}
			let said = '';
			const child = spawn(this.binary, [...args, '-i', job.input, '-o', reply, framed(job)], {
				stdio: ['ignore', 'pipe', 'pipe'],
			});
			const hear = (chunk: Buffer): void => {
				said = `${said}${chunk.toString()}`.slice(-4000);
			};
			child.stdout.on('data', hear);
			child.stderr.on('data', hear);
			child.on('error', (failure) => {
				reject(new FigureException(FigureExceptionKey.DrawFailed, `${this.binary}: ${failure.message}`));
			});
			child.on('close', (code) => {
				if (existsSync(job.output)) {
					resolve();
					return;
				}
				const last = said.trim().split('\n').slice(-3).join(' | ');
				const key = quota.test(said) ? FigureExceptionKey.DrawQuota : FigureExceptionKey.DrawFailed;
				reject(new FigureException(key, `exit ${String(code)}, no ${basename(job.output)}: ${last}`));
			});
		});
	}
}
