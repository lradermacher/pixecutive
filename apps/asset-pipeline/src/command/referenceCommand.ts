// referenceCommand.ts — builds the prompt for one figure and develops a passing reference, or only shows the prompt.
import {
	AssetException,
	AssetExceptionKey,
	ReferenceDevelopmentService,
	ReferencePromptService,
	type Verdict,
} from '@pixecutive/core';
import type { AssetData } from '../load-asset-data.ts';

/**
 * Finds the figure, builds its prompt and, unless `dryRun`, renders and checks until a reference passes.
 * @throws AssetException InvalidData for an unknown figure, the prompt and development failures of the core.
 */
export async function referenceCommand(
	data: AssetData,
	figure: string,
	development: ReferenceDevelopmentService | null,
): Promise<{ readonly prompt: string; readonly verdict: Verdict | null }> {
	const spec = data.specs.find((candidate) => candidate.id === figure);
	if (spec === undefined)
		throw new AssetException(
			AssetExceptionKey.InvalidData,
			`unknown figure ${figure}; known: ${data.specs.map((known) => known.id).join(', ')}`,
		);
	const prompt = new ReferencePromptService().build(data.template, spec, data.errorTypes);
	if (development === null) return { prompt, verdict: null };
	return { prompt, verdict: await development.develop(spec, prompt, data.template.seed) };
}
