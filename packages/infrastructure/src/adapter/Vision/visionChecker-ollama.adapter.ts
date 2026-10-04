// visionChecker-ollama.adapter.ts — asks the local Ollama vision model, feature by feature, whether an image shows it.
import { readFileSync } from 'node:fs';
import type { Feature, IVisionChecker } from '@pixecutive/core';
import { visionAnswer } from './visionAnswer.ts';

/**
 * One yes-or-no question per feature. `keep_alive: 0` unloads the model after every answer, so the vision model never
 * shares memory with the image model of the next render.
 */
export class OllamaVisionCheckerAdapter implements IVisionChecker {
	constructor(
		private readonly url: string,
		private readonly model: string,
	) {}

	async failedFeatures(image: string, features: readonly Feature[]): Promise<readonly string[]> {
		const picture = readFileSync(image).toString('base64');
		const failed: string[] = [];
		for (const feature of features) {
			const response = await fetch(`${this.url}/api/generate`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					model: this.model,
					prompt: `Look at the image. Does it clearly show this: ${feature.description}? Answer only yes or no.`,
					images: [picture],
					stream: false,
					keep_alive: 0,
				}),
			});
			const body = (await response.json()) as { readonly response?: string };
			if (!response.ok || !visionAnswer(body.response ?? '')) failed.push(feature.id);
		}
		return failed;
	}
}
