import { createConnection } from "node:net";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export type SearchMode = "auto" | "substring" | "wildcard" | "regex" | "fuzzy";

export interface LokiiFile {
  name: string;
  path: string;
  isDir: boolean;
  extension: string;
}

interface SearchOptions {
  mode?: SearchMode;
  limit?: number;
  signal?: AbortSignal;
  socketPath?: string;
  timeoutMs?: number;
}

function isFile(value: unknown): value is LokiiFile {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === "string" &&
    typeof entry.path === "string" &&
    isAbsolute(entry.path) &&
    typeof entry.isDir === "boolean" &&
    typeof entry.extension === "string"
  );
}

function parseResponse(frame: Buffer): LokiiFile[] {
  let response;
  try {
    response = JSON.parse(frame.toString("utf8"));
  } catch {
    throw new Error("Lokii 返回的 JSON 无效");
  }
  if (typeof response?.error === "string") throw new Error(response.error);
  if (!Array.isArray(response?.results) || !response.results.every(isFile)) throw new Error("Lokii 返回的文件列表无效");
  return response.results;
}

export async function searchLokii(
  query: string,
  {
    mode = "auto",
    limit = 50,
    signal,
    socketPath = join(homedir(), ".config", "lokii", "query.sock"),
    timeoutMs = 3000,
  }: SearchOptions = {},
): Promise<LokiiFile[]> {
  signal?.throwIfAborted();
  if (!query.trim()) return [];
  const request = JSON.stringify({ q: query, mode, limit }) + "\n";
  if (Buffer.byteLength(request) > 64 * 1024) throw new Error("搜索内容超过 Lokii 的长度限制");

  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath, signal });
    const timer = setTimeout(() => socket.destroy(new Error("Lokii 查询超时")), timeoutMs);
    const chunks: Buffer[] = [];
    let size = 0;

    socket.once("connect", () => socket.write(request));
    socket.once("error", reject);
    socket.once("close", () => {
      clearTimeout(timer);
      reject(new Error("Lokii 连接提前关闭"));
    });

    socket.on("data", (chunk: Buffer) => {
      const newline = chunk.indexOf(10);
      const part = newline === -1 ? chunk : chunk.subarray(0, newline);
      size += part.length;
      if (size > 4 * 1024 * 1024) {
        socket.destroy(new Error("Lokii 响应超过大小限制"));
        return;
      }
      chunks.push(part);
      if (newline === -1) return;
      try {
        resolve(parseResponse(Buffer.concat(chunks, size)));
      } catch (error) {
        reject(error);
      } finally {
        socket.destroy();
      }
    });
  });
}
