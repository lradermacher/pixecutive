import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BlenderReferenceCutoutAdapter } from './referenceCutout-blender.adapter.ts';

/** A fake Blender that prints what the real script prints, so the adapter's process handling is tested alone. */
function fakeBlender(output: string): string {
	const file = join(mkdtempSync(join(tmpdir(), 'blender-')), 'blender');
	writeFileSync(file, `#!/bin/sh\nprintf '%s\\n' 'Blender 5.2' '${output}'\n`);
	chmodSync(file, 0o755);
	return file;
}

describe('BlenderReferenceCutoutAdapter', () => {
	it('answers the paths the script wrote', async () => {
		const blender = fakeBlender('CUTOUT {"written":["a/view-0.png","a/view-1.png"]}');
		expect(await new BlenderReferenceCutoutAdapter(blender).cut('t.png', 2, '#00B140', 'a')).toEqual([
			'a/view-0.png',
			'a/view-1.png',
		]);
	});

	it('rejects with the script error when the border is not the key color', async () => {
		const blender = fakeBlender('CUTOUT {"error":"border color [0.9, 0.9, 0.9] is not the key color #00B140"}');
		await expect(new BlenderReferenceCutoutAdapter(blender).cut('t.png', 2, '#00B140', 'a')).rejects.toThrow(
			'is not the key color',
		);
	});

	it('rejects when the script answers nothing', async () => {
		await expect(
			new BlenderReferenceCutoutAdapter(fakeBlender('nothing')).cut('t.png', 2, '#00B140', 'a'),
		).rejects.toThrow('no CUTOUT line');
	});
});
