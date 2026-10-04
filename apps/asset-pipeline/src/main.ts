// main.ts — the asset pipeline's entry: hands the process's arguments, environment and streams to runPipeline.
//   pnpm assets reference <figure> [--dry] · pnpm assets cutout <figure> <image> · pnpm assets status
import { runPipeline } from './runPipeline.ts';

process.exitCode = await runPipeline(process.argv.slice(2), process.env, process.stdout, process.stderr);
