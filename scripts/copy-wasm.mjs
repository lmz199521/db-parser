/**
 * 把 sql.js 的 WASM 运行时复制到 public/ 目录。
 *
 * 为什么需要这一步：
 * sql.js 的核心是一个 WebAssembly 文件（约 640KB）。它不能被打包进 JS bundle，
 * 必须在运行时由浏览器按 URL 单独 fetch。放到 public/ 下，Vite 会原样拷贝到
 * 构建产物根目录，于是无论开发环境还是线上，都能通过相对路径取到。
 *
 * 为什么要额外做「一致性校验」：
 * sql.js 同时提供了 sql-wasm.wasm 和 sql-wasm-browser.wasm 两个文件，
 * 浏览器端 build 会请求后者。1.x 版本里这两个文件内容完全相同，所以我们只保留
 * 一份、由 locateFile 统一指向它（详见 src/lib/sqlite.ts 的注释）。
 * 但万一将来升级 sql.js 后两者不再相同，只留一份就会导致运行时报错，
 * 因此这里主动比对：一旦不一致，就把两个文件都拷过去，并在日志里明确告警。
 */
import { copyFile, mkdir, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const distDir = resolve(projectRoot, 'node_modules/sql.js/dist');
const targetDir = resolve(projectRoot, 'public');

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

const sha256 = async (p) => {
  const buf = await readFile(p);
  return createHash('sha256').update(buf).digest('hex');
};

async function main() {
  const main = resolve(distDir, 'sql-wasm.wasm');
  const browser = resolve(distDir, 'sql-wasm-browser.wasm');

  if (!(await exists(main))) {
    console.error('[sync:wasm] 找不到 sql.js 的 wasm 文件，请先执行 npm install');
    process.exit(1);
  }

  await mkdir(targetDir, { recursive: true });
  await copyFile(main, resolve(targetDir, 'sql-wasm.wasm'));
  console.log('[sync:wasm] 已复制 sql-wasm.wasm → public/');

  if (await exists(browser)) {
    const [a, b] = await Promise.all([sha256(main), sha256(browser)]);
    if (a !== b) {
      // 版本升级导致两者不一致：必须两个都拷，否则浏览器端会 404
      await copyFile(browser, resolve(targetDir, 'sql-wasm-browser.wasm'));
      console.warn(
        '[sync:wasm] ⚠️ sql-wasm.wasm 与 sql-wasm-browser.wasm 内容不一致，已同时拷贝两份。\n' +
          '           请检查 src/lib/sqlite.ts 里的 locateFile 是否仍指向 sql-wasm.wasm。',
      );
    }
  }
}

main().catch((err) => {
  console.error('[sync:wasm] 失败：', err);
  process.exit(1);
});
