// check-images.ts — images and videos enter the history only as small PNG product assets under one folder.

const media = /\.(png|jpg|jpeg|gif|webp|avif|bmp|tiff?|heic|ico|svg|mp4|mov|webm|mkv|avi|m4v)$/i;
const assetRoot = 'apps/office-ui/assets/';
const maxAssetBytes = 256 * 1024;

/**
 * Returns one finding per file that breaks the asset rules: an image or video outside `apps/office-ui/assets/`, an
 * image there that is no PNG, or an asset above 256 KB. The layout inside the folder is decided with the first real
 * assets. A deleted image stays in the history forever, so it is stopped before.
 */
export function checkImages(files: ReadonlyArray<{ path: string; bytes: number }>): string[] {
	const findings: string[] = [];
	for (const { path, bytes } of files) {
		const inAssets = path.startsWith(assetRoot);
		if (!inAssets && !media.test(path)) continue;
		if (!inAssets) {
			findings.push(`${path} — images and videos enter the repo only as PNG assets under ${assetRoot}`);
		} else if (media.test(path) && !path.endsWith('.png')) {
			findings.push(`${path} — a product asset image is a PNG`);
		} else if (bytes > maxAssetBytes) {
			findings.push(`${path} — ${Math.ceil(bytes / 1024)} KB, a product asset has at most ${maxAssetBytes / 1024} KB`);
		}
	}
	return findings;
}
