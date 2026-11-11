import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import test from "node:test";
import { resultDirectory, searchInDirectory } from "../src/search-scope.ts";

test("a directory scopes to itself and a file scopes to its containing directory", () => {
  assert.equal(resultDirectory({ path: "/work/docs", isDir: true }), "/work/docs");
  assert.equal(resultDirectory({ path: "/work/docs/note", isDir: false }), "/work/docs");
});

test("scoped requests preserve advanced queries and enforce the exact directory boundary", async (t) => {
  const tmp = await mkdtemp("/tmp/lokii-scope-");
  const socketPath = join(tmp, "query.sock");
  const requests: { q: string; mode: string }[] = [];
  const paths = ["/work/My Folder-old/x", "/work/My Folder/a/x", "/work/My Folder/x", "/work/My Folder"];
  const entries = paths.map((path) => ({ path, name: "x", isDir: false, extension: "" }));
  const server = createServer((socket) => {
    let line = "";
    socket.setEncoding("utf8").on("data", (chunk) => {
      line += chunk;
      if (!line.includes("\n")) return;
      requests.push(JSON.parse(line));
      socket.end(JSON.stringify({ results: entries }) + "\n");
    });
  });
  t.after(async () => {
    if (server.listening) await new Promise<void>((done) => server.close(() => done()));
    await rm(tmp, { recursive: true, force: true });
  });
  server.listen(socketPath);
  await once(server, "listening");
  for (const [query, mode, expected] of [
    ["x", "auto", "in:/work x"],
    ["^x$", "regex", "^x$"],
    ["x", "fuzzy", "x"],
    ["x*", "wildcard", "x*"],
    ["regex:^x", "auto", "regex:^x"],
  ] as const) {
    const found = await searchInDirectory(query, "/work/My Folder", { mode, socketPath });
    assert.deepEqual(
      found.map((file) => file.path),
      paths.slice(1, 3),
    );
    assert.equal(requests.at(-1)?.q, expected);
    assert.equal(requests.at(-1)?.mode, mode);
  }
});
