// check-images.ts — images and videos enter the history only as product assets, in one place and small.

const media = /\.(png|jpg|jpeg|gif|webp|avif|bmp|tiff?|heic|ico|svg|mp4|mov|webm|mkv|avi|m4v)$/i;
const assetPlace = /^apps\/web\/assets\/.+\.(png|svg)$/;
const maxAssetBytes = 256 * 1024;

/**
 * Returns one finding per image or video that is not a product asset: anywhere outside `apps/web/assets/`, in another
 * format than PNG or SVG, or above 256 KB. A deleted image stays in the history forever, so it is stopped before.
 */
export function checkImages(files: ReadonlyArray<{ path: string; bytes: number }>): string[] {
	const findings: string[] = [];
	for (const { path, bytes } of files) {
		if (!media.test(path)) continue;
		if (!assetPlace.test(path)) {
			findings.push(`${path} — images and videos enter the repo only as PNG or SVG assets under apps/web/assets/`);
		} else if (bytes > maxAssetBytes) {
			findings.push(`${path} — ${Math.ceil(bytes / 1024)} KB, a product asset has at most ${maxAssetBytes / 1024} KB`);
		}
	}
	return findings;
}
