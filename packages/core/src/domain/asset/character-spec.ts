// character-spec.ts — what a figure must look like: its features, each with a prompt sentence, a check and a source.
import type { FeatureCheck } from './feature-check.ts';
import type { Animation } from './animation.ts';
import type { Joint } from './joint.ts';

/** One feature of a figure. `source` names where it was decided: a sheet answer or the maintainer's words. */
export interface Feature {
	readonly id: string;
	readonly description: string;
	readonly promptSentence: string;
	readonly check: FeatureCheck;
	readonly source: string;
}

/** The spec of one figure: the reference it starts from, its features, joints and animations. */
export interface CharacterSpec {
	readonly id: string;
	readonly baseImage: string;
	readonly features: readonly Feature[];
	readonly joints: readonly Joint[];
	readonly animations: readonly Animation[];
}
