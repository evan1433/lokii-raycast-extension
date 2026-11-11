import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { searchLokii } from "../src/lokii-client.ts";

async function serve(t: TestContext, reply: (socket: Socket, request: string) => void) {
  const dir = await mkdtemp("/tmp/lokii-test-");
  const socketPath = join(dir, "query.sock");
  const server = createServer((socket) => {
    let line = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      line += chunk;
      if (line.endsWith("\n")) reply(socket, line);
    });
  });
  t.after(async () => {
    if (server.listening) await new Promise<void>((done) => server.close(() => done()));
    await rm(dir, { recursive: true, force: true });
  });
  server.listen(socketPath);
  await once(server, "listening");
  return socketPath;
}

test("writes one JSON line and reads a split UTF-8 character without changing result order", async (t) => {
  const files = ["笔记.md", "笔记"].map((name, i) => ({
    name,
    path: "/tmp/" + name,
    isDir: i === 1,
    extension: i === 1 ? "" : "md",
  }));
  const socketPath = await serve(t, (socket, line) => {
    assert.deepEqual(JSON.parse(line), { q: "笔\n记", mode: "fuzzy", limit: 5 });
    const data = Buffer.from(JSON.stringify({ results: files, error: null }) + "\n");
    const split = data.indexOf(Buffer.from("笔")) + 1;
    socket.write(data.subarray(0, split));
    setTimeout(() => socket.end(data.subarray(split)), 5);
  });
  assert.deepEqual(await searchLokii("笔\n记", { mode: "fuzzy", limit: 5, socketPath }), files);
});

for (const [title, payload, message] of [
  ["server error", '{"results":[],"error":"invalid regex"}\n', /invalid regex/],
  ["invalid JSON", "invalid\n", /JSON/],
  ["invalid file entry", '{"results":[{}]}\n', /文件列表/],
  ["partial frame", '{"results":[]}', /提前关闭/],
] as const) {
  test(title, async (t) => {
    const socketPath = await serve(t, (socket) => socket.end(payload));
    await assert.rejects(searchLokii("query", { socketPath }), message);
  });
}

test("times out if the server never replies", async (t) => {
  const socketPath = await serve(t, () => {});
  await assert.rejects(searchLokii("query", { socketPath, timeoutMs: 50 }), /超时/);
});

test("aborting an in-flight query disconnects from the server", async (t) => {
  const controller = new AbortController();
  let closed!: () => void;
  const disconnected = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const socketPath = await serve(t, (socket) => {
    socket.once("close", closed);
    controller.abort();
  });
  await assert.rejects(searchLokii("query", { socketPath, signal: controller.signal }), { name: "AbortError" });
  await disconnected;
});

test("a missing socket reports a connection error, while an empty query never connects", async () => {
  const socketPath = "/tmp/lokii-test-nonexistent/query.sock";
  assert.deepEqual(await searchLokii("  ", { socketPath }), []);
  await assert.rejects(searchLokii("query", { socketPath }), { code: "ENOENT" });
});
