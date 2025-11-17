import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

import { dependencies } from './package.json';

const drivers = Object.fromEntries(
  fs.readdirSync(path.resolve(`src/drivers`)).map(file => {
    const name = file.replace(/\.ts$/i, '');
    const input = `drivers/${name}`;
    const source = `src/${input}.ts`;
    return [input, source];
  })
);

const basic = defineConfig({
  input: {
    index: 'src/index.ts',
    ...drivers
  },
  platform: 'node',
  treeshake: true,
  external: Object.keys(dependencies || {}).concat(/^unstorage\/drivers\/.*/i)
});

export default defineConfig([
  {
    ...basic,
    output: {
      dir: 'dist',
      format: 'commonjs',
      exports: 'named',
      cleanDir: true,
      chunkFileNames: `chunk.js`,
      entryFileNames: '[name].js'
      // entryFileNames: info => (isDriver(info.facadeModuleId) ? 'drivers/[name].js' : '[name].js')
    }
  },
  {
    ...basic,
    plugins: [
      dts({
        emitDtsOnly: true,
        compilerOptions: { removeComments: false }
      })
    ],
    output: {
      dir: 'dist',
      format: 'esm',
      chunkFileNames: `chunk.js`,
      entryFileNames: '[name].js'
      // entryFileNames: info => (isDriver(info.facadeModuleId) ? 'drivers/[name].js' : '[name].js')
    }
  }
]);
