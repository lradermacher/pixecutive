// referencePrompt.service.ts — one prompt from the template, the figure's feature sentences and the known error types.
import type { CharacterSpec } from '../../domain/Asset/characterSpec.schema.ts';
import type { ErrorType } from '../../domain/Asset/errorType.schema.ts';
import type { ReferenceTemplate } from '../../domain/Asset/referenceTemplate.schema.ts';
import { AssetException } from '../exception/asset.exception.ts';
import { AssetExceptionKey } from '../exception/assetExceptionKey.enum.ts';

/**
 * Builds the reference prompt for a figure; deterministic given template, spec and error types.
 * @throws AssetException ForbiddenPrompt from `build` when a forbidden phrase remains.
 */
export class ReferencePromptService {
	/**
	 * Inserts the spec's feature sentences where the template says `{features}`, removes every phrase an error type
	 * strips, and rejects the prompt when a forbidden phrase is still in it, so a known failure is never rendered again.
	 * @throws AssetException ForbiddenPrompt when a forbidden phrase remains.
	 */
	build(template: ReferenceTemplate, spec: CharacterSpec, errorTypes: readonly ErrorType[]): string {
		const sentences = spec.features
			.map((feature) => feature.promptSentence.trim())
			.filter((sentence) => sentence !== '')
			.join(' ');
		let prompt = template.prompt.replace('{features}', sentences);
		for (const type of errorTypes) for (const phrase of type.strip) prompt = prompt.split(phrase).join('');
		prompt = prompt.replace(/\s+/g, ' ').trim();
		for (const type of errorTypes) {
			const hit = type.forbid.find((phrase) => prompt.toLowerCase().includes(phrase.toLowerCase()));
			if (hit !== undefined)
				throw new AssetException(AssetExceptionKey.ForbiddenPrompt, `"${hit}" causes ${type.id}: ${type.description}`);
		}
		return prompt;
	}
}
