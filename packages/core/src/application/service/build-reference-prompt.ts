// build-reference-prompt.ts — one prompt from the template, the figure's feature sentences and the known error types.
import type { CharacterSpec } from '../../domain/asset/character-spec.ts';
import type { ErrorType } from '../../domain/asset/error-type.ts';
import type { ReferenceTemplate } from '../../domain/asset/reference-template.ts';
import { AssetErrorKey } from '../exception/asset-error-key.ts';
import { AssetException } from '../exception/asset-exception.ts';

/**
 * Inserts the spec's feature sentences where the template says `{features}`, removes every phrase an error type
 * strips, and rejects the prompt when a forbidden phrase is still in it, so a known failure is never rendered again.
 * @throws AssetException InvalidData without the placeholder, ForbiddenPrompt when a forbidden phrase remains.
 */
export function buildReferencePrompt(
	template: ReferenceTemplate,
	spec: CharacterSpec,
	errorTypes: readonly ErrorType[],
): string {
	if (!template.prompt.includes('{features}'))
		throw new AssetException(AssetErrorKey.InvalidData, 'the template prompt has no {features} placeholder');
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
			throw new AssetException(AssetErrorKey.ForbiddenPrompt, `"${hit}" causes ${type.id}: ${type.description}`);
	}
	return prompt;
}
