// check-images.ts — images and videos enter the history only as product assets, in one place, one layout and small.

const media = /\.(png|jpg|jpeg|gif|webp|avif|bmp|tiff?|heic|ico|svg|mp4|mov|webm|mkv|avi|m4v)$/i;
const assetRoot = 'apps/office-ui/assets/';
const segment = '[a-z0-9]+(?:-[a-z0-9]+)*';
// <category>/<name>/ then a manifest, a sprite sheet per action and direction 0 to 7, or a texture variant.
const assetLayout = new RegExp(
	`^${assetRoot}${segment}/${segment}/(?:manifest\\.json|animations/${segment}/[0-7]\\.png|textures/${segment}\\.png)$`,
);
const maxAssetBytes = 256 * 1024;

/**
 * Returns one finding per file that breaks the asset rules: an image or video outside `apps/office-ui/assets/`, any
 * file there outside the layout `<category>/<name>/{manifest.json, animations/<action>/<direction>.png,
 * textures/<variant>.png}`, or an asset above 256 KB. A deleted image stays in the history forever, so it is stopped
 * before.
 */
export function checkImages(files: ReadonlyArray<{ path: string; bytes: number }>): string[] {
	const findings: string[] = [];
	for (const { path, bytes } of files) {
		const inAssets = path.startsWith(assetRoot);
		if (!inAssets && !media.test(path)) continue;
		if (!inAssets) {
			findings.push(`${path} — images and videos enter the repo only as PNG assets under ${assetRoot}`);
		} else if (!assetLayout.test(path)) {
			findings.push(
				`${path} — an asset lies at ${assetRoot}<category>/<name>/ as manifest.json, animations/<action>/<direction 0-7>.png or textures/<variant>.png`,
			);
		} else if (bytes > maxAssetBytes) {
			findings.push(`${path} — ${Math.ceil(bytes / 1024)} KB, a product asset has at most ${maxAssetBytes / 1024} KB`);
		}
	}
	return findings;
}
