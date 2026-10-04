// parse-error-types.ts — turns the error types file into checked ErrorTypes.
import type { ErrorType } from '../../domain/asset/error-type.ts';
import { FieldReader } from './field-reader.ts';

/** Validates parsed JSON as the list of error types; `path` names the file in the error. */
export function parseErrorTypes(value: unknown, path: string): readonly ErrorType[] {
	const file = new FieldReader(value, path);
	return file.list('types').map((_item, index) => {
		const type = file.child('types', index);
		return {
			id: type.text('id'),
			description: type.text('description'),
			strip: type.texts('strip'),
			forbid: type.texts('forbid'),
		};
	});
}
