import { dirname, normalize, sep } from "node:path";
import { searchLokii, type LokiiFile, type SearchMode } from "./lokii-client.ts";

export function resultDirectory(file: Pick<LokiiFile, "path" | "isDir">) {
  return file.isDir ? file.path : dirname(file.path);
}

// The socket has no directory field. Lokii tokenizes in:<path> on whitespace,
// and adding it to regex or fuzzy queries changes the engine that handles them.
function serverScope(directory: string, query: string, mode: SearchMode) {
  if (mode !== "auto" && mode !== "substring") return undefined;
  if (!/^[\p{L}\p{M}\p{N}_ .-]+$/u.test(query) || query.trim().startsWith(".")) return undefined;
  let scope = directory;
  while (/[\s|*?]/u.test(scope)) scope = dirname(scope);
  return scope;
}

export async function searchInDirectory(
  query: string,
  directory: string,
  options: {
    mode?: SearchMode;
    signal?: AbortSignal;
    socketPath?: string;
  } = {},
): Promise<LokiiFile[]> {
  if (!query.trim()) return [];
  const base = normalize(directory);
  const prefix = base.endsWith(sep) ? base : base + sep;
  const scope = serverScope(base, query, options.mode ?? "auto");
  const results = await searchLokii(scope ? `in:${scope} ${query}` : query, {
    ...options,
    limit: scope === base ? 50 : 1000,
  });
  // Enforce a complete path component, including when Lokii matched a wider ancestor.
  return results.filter((entry) => entry.path.startsWith(prefix) && entry.path !== base).slice(0, 50);
}
