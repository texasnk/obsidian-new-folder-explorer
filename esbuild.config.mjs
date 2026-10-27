import esbuild from 'esbuild';
import process from 'node:process';

const isWatching = process.argv.includes('--watch');
const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  // CodeMirror extensions must use Obsidian's own CodeMirror instances.
  // Bundling these packages creates incompatible extension values at runtime.
  external: ['obsidian', '@codemirror/state', '@codemirror/view'],
  format: 'cjs',
  target: 'es2022',
  sourcemap: 'inline',
  logLevel: 'info',
  outfile: 'main.js',
});

if (isWatching) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
