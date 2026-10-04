// develop-reference.ts — render a reference, check it against its spec, retry with the next seed at most three times.
import type { CharacterSpec } from '../../domain/asset/character-spec.ts';
import type { Verdict } from '../../domain/asset/verdict.ts';
import type { IClock } from '../../port/outgoing/clock.interface.ts';
import type { IReferenceRenderer } from '../../port/outgoing/reference-renderer.interface.ts';
import type { IVerdictLog } from '../../port/outgoing/verdict-log.interface.ts';
import type { IVisionChecker } from '../../port/outgoing/vision-checker.interface.ts';
import { FeatureCheck } from '../../domain/asset/feature-check.ts';
import { AssetErrorKey } from '../exception/asset-error-key.ts';
import { AssetException } from '../exception/asset-exception.ts';

/** The first render plus at most three retries. */
const attempts = 4;

/**
 * Renders until a reference passes every vision-checked feature, at most four renders. Every check is logged as a
 * verdict. A render that did not finish (the memory guard stopped it) ends the run instead of trying the next seed,
 * because the next render would meet the same memory.
 * @throws AssetException NoPassingReference when the guard stopped a render or no render passed.
 */
export async function developReference(
	ports: {
		readonly renderer: IReferenceRenderer;
		readonly checker: IVisionChecker;
		readonly log: IVerdictLog;
		readonly clock: IClock;
	},
	spec: CharacterSpec,
	prompt: string,
	firstSeed: number,
): Promise<Verdict> {
	const checked = spec.features.filter((feature) => feature.check === FeatureCheck.Vision);
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const seed = firstSeed + attempt - 1;
		const outcome = await ports.renderer.render(spec.baseImage, prompt, seed);
		if (outcome.image === null)
			throw new AssetException(AssetErrorKey.NoPassingReference, `render stopped: ${outcome.problem}`);
		const failures = await ports.checker.failedFeatures(outcome.image, checked);
		const verdict: Verdict = {
			figure: spec.id,
			image: outcome.image,
			seed,
			attempt,
			failures,
			at: ports.clock.nowIso(),
		};
		await ports.log.append(verdict);
		if (failures.length === 0) return verdict;
	}
	throw new AssetException(
		AssetErrorKey.NoPassingReference,
		`${spec.id}: no reference passed in ${String(attempts)} renders`,
	);
}
