// referenceDevelopment.service.ts — render a reference, check it against its spec, retry with the next seed at most
// three times, and log every verdict.
import type { CharacterSpec } from '../../domain/Asset/characterSpec.schema.ts';
import { FeatureCheck } from '../../domain/Asset/featureCheck.enum.ts';
import type { Verdict } from '../../domain/Asset/verdict.interface.ts';
import type { IClock } from '../../port/outgoing/clock.interface.ts';
import type { IReferenceRenderer } from '../../port/outgoing/referenceRenderer.interface.ts';
import type { IVerdictLog } from '../../port/outgoing/verdictLog.interface.ts';
import type { IVisionChecker } from '../../port/outgoing/visionChecker.interface.ts';
import { AssetException } from '../exception/asset.exception.ts';
import { AssetExceptionKey } from '../exception/assetExceptionKey.enum.ts';

/** The first render plus at most three retries. */
const attempts = 4;

/**
 * Develops one passing reference per figure from the ports it is given.
 * @throws AssetException NoPassingReference from `develop` when no render passes.
 */
export class ReferenceDevelopmentService {
	constructor(
		private readonly renderer: IReferenceRenderer,
		private readonly checker: IVisionChecker,
		private readonly log: IVerdictLog,
		private readonly clock: IClock,
	) {}

	/**
	 * Renders until a reference passes every vision-checked feature, at most four renders. A render the memory guard
	 * stopped ends the run instead of trying the next seed, because the next render would meet the same memory.
	 * @throws AssetException NoPassingReference when the guard stopped a render or no render passed.
	 */
	async develop(spec: CharacterSpec, prompt: string, firstSeed: number): Promise<Verdict> {
		const checked = spec.features.filter((feature) => feature.check === FeatureCheck.Vision);
		for (let attempt = 1; attempt <= attempts; attempt += 1) {
			const seed = firstSeed + attempt - 1;
			const outcome = await this.renderer.render(spec.baseImage, prompt, seed);
			if (outcome.image === null)
				throw new AssetException(AssetExceptionKey.NoPassingReference, `render stopped: ${outcome.problem}`);
			const failures = await this.checker.failedFeatures(outcome.image, checked);
			const verdict: Verdict = { figure: spec.id, image: outcome.image, seed, attempt, failures, at: this.clock.now() };
			await this.log.append(verdict);
			if (failures.length === 0) return verdict;
		}
		throw new AssetException(
			AssetExceptionKey.NoPassingReference,
			`${spec.id}: no reference passed in ${String(attempts)} renders`,
		);
	}
}
