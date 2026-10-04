// parse-character-spec.ts — turns a character spec file into a checked CharacterSpec, or names the wrong field.
import { Animation } from '../../domain/asset/animation.ts';
import type { CharacterSpec } from '../../domain/asset/character-spec.ts';
import { FeatureCheck } from '../../domain/asset/feature-check.ts';
import { FieldReader } from './field-reader.ts';
import { Joint } from '../../domain/asset/joint.ts';

/** Validates parsed JSON as a character spec; `path` names the file in the error. */
export function parseCharacterSpec(value: unknown, path: string): CharacterSpec {
	const spec = new FieldReader(value, path);
	const features = spec.list('features').map((_item, index) => {
		const feature = spec.child('features', index);
		return {
			id: feature.text('id'),
			description: feature.text('description'),
			promptSentence: feature.text('promptSentence'),
			check: feature.member('check', FeatureCheck),
			source: feature.text('source'),
		};
	});
	return {
		id: spec.text('id'),
		baseImage: spec.text('baseImage'),
		features,
		joints: spec.members('joints', Joint),
		animations: spec.members('animations', Animation),
	};
}
