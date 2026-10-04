// parse-design-line.ts — turns the design line file into a checked DesignLine.
import type { DesignLine } from '../../domain/asset/design-line.ts';
import { FieldReader } from './field-reader.ts';

/** Validates parsed JSON as the design line; `path` names the file in the error. */
export function parseDesignLine(value: unknown, path: string): DesignLine {
	const file = new FieldReader(value, path);
	const choices = file.list('choices').map((_item, index) => {
		const choice = file.child('choices', index);
		return { key: choice.text('key'), value: choice.text('value'), source: choice.text('source') };
	});
	return { choices };
}
