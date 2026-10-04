// cutoutCommand.ts — cuts a passing reference of one figure into one transparent image per view.
import { join } from 'node:path';
import { AssetException, AssetExceptionKey, type IReferenceCutout } from '@pixecutive/core';
import type { AssetData } from '../load-asset-data.ts';

/**
 * Splits `image` into as many panels as the template has views and writes them under `<rendersDir>/<figure>/views`.
 * @throws AssetException InvalidData for an unknown figure.
 */
export function cutoutCommand(
	data: AssetData,
	figure: string,
	image: string,
	rendersDir: string,
	cutout: IReferenceCutout,
): Promise<readonly string[]> {
	if (!data.specs.some((spec) => spec.id === figure))
		throw new AssetException(AssetExceptionKey.InvalidData, `unknown figure ${figure}`);
	return cutout.cut(image, data.template.views.length, data.template.keyColor, join(rendersDir, figure, 'views'));
}
