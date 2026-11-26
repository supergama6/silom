import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4174);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const decoded = decodeURIComponent(url.pathname);
    const safePath = path.normalize(decoded).replace(/^(?:\.\.(?:[/\\]|$))+/, "");
    let filePath = path.join(projectRoot, safePath === path.sep ? "index.html" : safePath);
    const fileStat = await stat(filePath).catch(() => null);
    if (fileStat?.isDirectory()) filePath = path.join(filePath, "index.html");
    const finalStat = await stat(filePath).catch(() => null);
    if (!finalStat?.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(String(error));
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Silom clone preview: http://127.0.0.1:${port}/`);
});
