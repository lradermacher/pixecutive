import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeatureCheck } from '@pixecutive/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OllamaVisionCheckerAdapter } from './visionChecker-ollama.adapter.ts';

const bodies: Record<string, unknown>[] = [];
let server: Server;
let url = '';

beforeAll(async () => {
	server = createServer((request, response) => {
		let raw = '';
		request.on('data', (chunk: Buffer) => (raw += chunk.toString()));
		request.on('end', () => {
			const body = JSON.parse(raw) as Record<string, unknown>;
			bodies.push(body);
			response.end(JSON.stringify({ response: String(body['prompt']).includes('mouth') ? 'No.' : 'Yes.' }));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, resolve));
	const address = server.address();
	url = `http://127.0.0.1:${String(typeof address === 'object' && address !== null ? address.port : 0)}`;
});

afterAll(() => {
	server.close();
});

describe('OllamaVisionCheckerAdapter', () => {
	it('returns the ids of the features the model does not see, and unloads the model after each answer', async () => {
		const image = join(mkdtempSync(join(tmpdir(), 'vision-')), 'ref.png');
		writeFileSync(image, 'x');
		const features = [
			{ id: 'eyes', description: 'dark oval eyes', promptSentence: '', check: FeatureCheck.Vision, source: 's' },
			{ id: 'mouth', description: 'a smiling mouth', promptSentence: '', check: FeatureCheck.Vision, source: 's' },
		];
		const failed = await new OllamaVisionCheckerAdapter(url, 'qwen3-vl:8b').failedFeatures(image, features);
		expect(failed).toEqual(['mouth']);
		expect(bodies.map((body) => body['keep_alive'])).toEqual([0, 0]);
		expect(bodies[0]?.['images']).toEqual([Buffer.from('x').toString('base64')]);
	});
});
