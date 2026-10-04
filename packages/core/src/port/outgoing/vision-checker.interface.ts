// vision-checker.interface.ts — checks a rendered reference against the features of its spec.
import type { Feature } from '../../domain/asset/character-spec.ts';

/** Answers, for each feature checked by vision, whether the image shows it; returns the ids that failed. */
export interface IVisionChecker {
	failedFeatures(image: string, features: readonly Feature[]): Promise<readonly string[]>;
}
