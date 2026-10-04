// field-reader.ts — reads typed fields out of parsed JSON and names the exact path of the first wrong one.
import { AssetErrorKey } from '../exception/asset-error-key.ts';
import { AssetException } from '../exception/asset-exception.ts';

/**
 * Reads the fields of one JSON object.
 * @throws AssetException InvalidData from every getter, naming `path.field` of the first wrong field.
 */
export class FieldReader {
	private readonly fields: Readonly<Record<string, unknown>>;
	private readonly path: string;

	constructor(value: unknown, path: string) {
		if (typeof value !== 'object' || value === null || Array.isArray(value))
			throw new AssetException(AssetErrorKey.InvalidData, `${path} is no object`);
		this.fields = value as Readonly<Record<string, unknown>>;
		this.path = path;
	}

	text(name: string): string {
		const value = this.fields[name];
		if (typeof value !== 'string' || value.trim() === '') this.fail(name, 'a non-empty string');
		return value;
	}

	whole(name: string): number {
		const value = this.fields[name];
		if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) this.fail(name, 'a whole number');
		return value;
	}

	list(name: string): readonly unknown[] {
		const value = this.fields[name];
		if (!Array.isArray(value)) this.fail(name, 'a list');
		return value as readonly unknown[];
	}

	texts(name: string): readonly string[] {
		return this.list(name).map((item, index) => {
			if (typeof item !== 'string') this.fail(`${name}[${String(index)}]`, 'a string');
			return item;
		});
	}

	member<T extends string>(name: string, allowed: Readonly<Record<string, T>>): T {
		const value = this.text(name);
		const hit = Object.values(allowed).find((option) => option === value);
		if (hit === undefined) this.fail(name, `one of ${Object.values(allowed).join(', ')}`);
		return hit;
	}

	members<T extends string>(name: string, allowed: Readonly<Record<string, T>>): readonly T[] {
		return this.texts(name).map((value) => {
			const hit = Object.values(allowed).find((option) => option === value);
			if (hit === undefined) this.fail(name, `values out of ${Object.values(allowed).join(', ')}`);
			return hit;
		});
	}

	child(name: string, index: number): FieldReader {
		return new FieldReader(this.list(name)[index], `${this.path}.${name}[${String(index)}]`);
	}

	private fail(name: string, expected: string): never {
		throw new AssetException(AssetErrorKey.InvalidData, `${this.path}.${name} must be ${expected}`);
	}
}
