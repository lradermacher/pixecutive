// load-asset-data.ts — reads the pipeline's data files and validates each against the core's schemas.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	AssetException,
	AssetExceptionKey,
	characterSpecSchema,
	designLineSchema,
	errorTypesSchema,
	referenceTemplateSchema,
	type CharacterSpec,
	type DesignLine,
	type ErrorType,
	type ReferenceTemplate,
} from '@pixecutive/core';
import type { z } from 'zod';

/** Everything the pipeline needs to build a reference: style, template, known failures and the figures. */
export interface AssetData {
	readonly designLine: DesignLine;
	readonly template: ReferenceTemplate;
	readonly errorTypes: readonly ErrorType[];
	readonly specs: readonly CharacterSpec[];
}

/**
 * Loads `design-line.json`, `reference-template.json`, `error-types.json` and every file in `specs/` from `dir`.
 * @throws AssetException InvalidData naming the file and the first wrong field.
 */
export function loadAssetData(dir: string): AssetData {
	const read = <T>(schema: z.ZodType<T>, name: string): T => {
		const result = schema.safeParse(JSON.parse(readFileSync(join(dir, name), 'utf8')));
		if (!result.success) {
			const issue = result.error.issues[0];
			throw new AssetException(
				AssetExceptionKey.InvalidData,
				`${name}: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`,
			);
		}
		return result.data;
	};
	const specFiles = readdirSync(join(dir, 'specs')).filter((name) => name.endsWith('.json'));
	return {
		designLine: read(designLineSchema, 'design-line.json'),
		template: read(referenceTemplateSchema, 'reference-template.json'),
		errorTypes: read(errorTypesSchema, 'error-types.json').types,
		specs: specFiles.map((name) => read(characterSpecSchema, join('specs', name))),
	};
}
