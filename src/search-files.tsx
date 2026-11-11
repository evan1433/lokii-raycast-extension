import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { useEffect, useState } from "react";
import { searchLokii, type LokiiFile, type SearchMode } from "./lokii-client";
import { FileActions } from "./file-actions";
import { resultDirectory, searchInDirectory } from "./search-scope";

const modes: Record<SearchMode, string> = {
  auto: "自动",
  substring: "子串",
  wildcard: "通配符",
  regex: "正则表达式",
  fuzzy: "模糊匹配",
};

function searchError(error: unknown) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code === "ENOENT" || code === "ECONNREFUSED") {
    return {
      title: "无法连接 Lokii",
      description: "请先启动 Lokii，再按回车重试。",
    };
  }
  return {
    title: "搜索未完成",
    description: error instanceof Error ? error.message : "请重试。",
  };
}

const home = homedir();
function displayDirectory(path: string) {
  const dir = dirname(path);
  return dir === home || dir.startsWith(home + "/") ? "~" + dir.slice(home.length) : dir;
}

type Request = { query: string; mode: SearchMode };
type Result = { request: Request } & ({ files: LokiiFile[] } | { error: ReturnType<typeof searchError> });

export default function SearchFiles() {
  return <SearchList />;
}

function SearchList({ directory, initialMode = "auto" }: { directory?: string; initialMode?: SearchMode }) {
  const [request, setRequest] = useState<Request>({
    query: "",
    mode: initialMode,
  });
  const [result, setResult] = useState<Result>();
  const hasQuery = Boolean(request.query.trim());
  const current = result?.request === request ? result : undefined;
  const loading = hasQuery && !current;

  useEffect(() => {
    if (!request.query.trim()) return;
    const controller = new AbortController();
    const { signal } = controller;
    const options = { mode: request.mode, signal };
    const pending = directory
      ? searchInDirectory(request.query, directory, options)
      : searchLokii(request.query, options);
    pending.then(
      (files) => {
        if (!signal.aborted) setResult({ request, files });
      },
      (error: unknown) => {
        if (!signal.aborted) setResult({ request, error: searchError(error) });
      },
    );
    return () => controller.abort();
  }, [request, directory]);

  const retry = (
    <ActionPanel>
      <Action title="重新搜索" icon={Icon.ArrowClockwise} onAction={() => setRequest({ ...request })} />
    </ActionPanel>
  );
  const files = current && "files" in current ? current.files : [];
  const error = current && "error" in current ? current.error : undefined;
  return (
    <List
      filtering={false}
      throttle
      isLoading={loading}
      onSearchTextChange={(query) => setRequest((prev) => (prev.query === query ? prev : { ...prev, query }))}
      navigationTitle={directory ? `仅在此目录搜索 · ${directory}` : undefined}
      searchBarPlaceholder={directory ? `在 ${directory} 中搜索…` : "使用 Lokii 搜索文件或文件夹…"}
      searchBarAccessory={
        <List.Dropdown
          tooltip="搜索模式"
          value={request.mode}
          onChange={(mode) => setRequest((prev) => (prev.mode === mode ? prev : { ...prev, mode: mode as SearchMode }))}
        >
          {Object.entries(modes).map(([value, title]) => (
            <List.Dropdown.Item key={value} title={title} value={value} />
          ))}
        </List.Dropdown>
      }
    >
      {!hasQuery ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="输入文件名开始搜索"
          description={
            directory
              ? `范围：${directory}（包含子目录）。按 Esc 返回上次搜索。`
              : "可以输入名称、路径或拼音，例如 README。"
          }
        />
      ) : loading ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="正在搜索…" />
      ) : error ? (
        <List.EmptyView icon={Icon.ExclamationMark} {...error} actions={retry} />
      ) : !files.length ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="没有找到匹配项"
          description={
            directory
              ? "试试更具体的文件名，或按 Esc 返回上次搜索。Lokii 的返回条数上限可能影响目录内结果。"
              : "试试更短的关键词。如果 Lokii 正在建立索引，稍后可按回车重试。"
          }
          actions={retry}
        />
      ) : (
        files.map((file) => (
          <List.Item
            key={file.path}
            id={file.path}
            quickLook={{ path: file.path }}
            icon={{ fileIcon: file.path }}
            title={file.name}
            subtitle={{
              value: displayDirectory(file.path),
              tooltip: file.path,
            }}
            accessories={[{ text: file.isDir ? "文件夹" : file.extension || "文件" }]}
            actions={
              <ActionPanel>
                <Action.Open title="打开" target={file.path} />
                <Action.CopyToClipboard
                  title="复制路径"
                  content={file.path}
                  shortcut={Keyboard.Shortcut.Common.CopyPath}
                />
                <Action.OpenWith title="选择打开方式" path={file.path} />
                <FileActions file={file} />
                {resultDirectory(file) !== directory && (
                  <Action.Push
                    title="仅在此目录搜索"
                    icon={Icon.MagnifyingGlass}
                    target={<SearchList directory={resultDirectory(file)} initialMode={request.mode} />}
                  />
                )}
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
