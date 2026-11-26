import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "evidence", "browser", "audit");
const cases = [
  { name: "desktop", width: 1440, height: 841 },
  { name: "mobile", width: 390, height: 784 },
];
const report = [];
await mkdir(outputRoot, { recursive: true });

for (const item of cases) {
  const sourcePath = path.join(projectRoot, "evidence", "browser", "source", `home-${item.name}.png`);
  const localPath = path.join(projectRoot, "evidence", "browser", "local", `home-${item.name}.png`);
  const [sourceBuffer, localBuffer] = await Promise.all([
    sharp(sourcePath).extract({ left: 0, top: 0, width: item.width, height: item.height }).ensureAlpha().png().toBuffer(),
    sharp(localPath).extract({ left: 0, top: 0, width: item.width, height: item.height }).ensureAlpha().png().toBuffer(),
  ]);
  const source = PNG.sync.read(sourceBuffer);
  const local = PNG.sync.read(localBuffer);
  const diff = new PNG({ width: item.width, height: item.height });
  const differentPixels = pixelmatch(source.data, local.data, diff.data, item.width, item.height, { threshold: 0.1, includeAA: false });
  const diffPath = path.join(outputRoot, `above-fold-${item.name}-diff.png`);
  await writeFile(diffPath, PNG.sync.write(diff));
  report.push({
    viewport: item.name,
    width: item.width,
    height: item.height,
    differentPixels,
    totalPixels: item.width * item.height,
    similarityPercent: Number((100 * (1 - differentPixels / (item.width * item.height))).toFixed(4)),
    diff: path.relative(projectRoot, diffPath),
  });
}

await writeFile(path.join(outputRoot, "above-fold-pixel-diff.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
