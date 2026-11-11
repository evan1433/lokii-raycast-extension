import { Action, ActionPanel, Icon, Keyboard } from "@raycast/api";
import { dirname } from "node:path";
import type { LokiiFile } from "./lokii-client";

export function FileActions({ file }: { file: LokiiFile }) {
  const directory = file.isDir ? file.path : dirname(file.path);
  return (
    <ActionPanel.Section title="文件操作">
      {file.isDir ? (
        <Action.Open title="在 Finder 中打开" target={file.path} application="com.apple.finder" icon={Icon.Finder} />
      ) : (
        <Action.ShowInFinder title="在 Finder 中打开" path={file.path} />
      )}
      <Action.ToggleQuickLook title="快速查看" shortcut={Keyboard.Shortcut.Common.ToggleQuickLook} />
      <Action.CopyToClipboard
        title={file.isDir ? "拷贝文件夹" : "拷贝文件"}
        content={{ file: file.path }}
        shortcut={Keyboard.Shortcut.Common.Copy}
      />
      <Action.CopyToClipboard title="拷贝名称" content={file.name} shortcut={Keyboard.Shortcut.Common.CopyName} />
      <Action.Open title="在终端中打开" target={directory} application="com.apple.Terminal" icon={Icon.Terminal} />
    </ActionPanel.Section>
  );
}
