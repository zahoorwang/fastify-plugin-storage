/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} dir
 */
function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} dir
 */
function rmdir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

/**
 * @param {string} dir
 * @param {string} content
 */
function writer(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

/**
 * @typedef {Object} FindUpMeta
 * @property {string} source  The source path that was found
 * @property {string} content The file content
 */

/**
 * @param {string} dir
 * @returns {FindUpMeta[]}
 */
function findup(dir) {
  return fs
    .readdirSync(path.resolve(dir))
    .filter(file => file.endsWith('.d.ts'))
    .map(file => {
      const name = file.replace(/\.d\.ts$/i, '');
      const input = `drivers/${name}`;
      const source = `src/${input}.ts`;
      const content = `export { default } from 'unstorage/${input}';\nexport * from 'unstorage/${input}';\r\n`;
      return { source, content };
    });
}

/**
 * @param {FindUpMeta[]} metas
 */
function writes(metas) {
  metas.forEach(meta => writer(meta.source, meta.content));
}

rmdir(`src/drivers`);
mkdir(`src/drivers`);
writes(findup(`node_modules/unstorage/drivers`));
