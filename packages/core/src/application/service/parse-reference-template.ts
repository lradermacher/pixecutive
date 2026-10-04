// parse-reference-template.ts — turns the reference template file into a checked ReferenceTemplate.
import { FieldReader } from './field-reader.ts';
import type { ReferenceTemplate } from '../../domain/asset/reference-template.ts';
import { View } from '../../domain/asset/view.ts';

/** Validates parsed JSON as the reference template; `path` names the file in the error. */
export function parseReferenceTemplate(value: unknown, path: string): ReferenceTemplate {
	const template = new FieldReader(value, path);
	return {
		views: template.members('views', View),
		prompt: template.text('prompt'),
		width: template.whole('width'),
		height: template.whole('height'),
		seed: template.whole('seed'),
		keyColor: template.text('keyColor'),
	};
}
