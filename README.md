# Lokii Search for Raycast

在 Raycast 里输入文件名，直接搜索 [Lokii](https://github.com/huangy7/lokii) 已建立的本地索引。扩展通过 Unix socket 查询正在运行的 Lokii，无需安装 Lokii CLI，也不会重新扫描磁盘。

## 本机试用

1. 在 macOS 上安装并打开 [Raycast](https://www.raycast.com/) 和 [Lokii](https://github.com/huangy7/lokii/releases)。首次运行时，在 Lokii 设置中选好索引目录，确认能在 Lokii 里搜到一个已知文件。
2. 安装 Node.js 24 LTS（自带 npm），在本项目目录运行：

   ```sh
   npm ci
   npm run dev
   ```

3. 在 Raycast 中运行 **Search Files with Lokii**。输入刚才的文件名，按 **↵** 打开选中项；按 **⌘ K** 查看结果操作。

这是一个独立的 Raycast 命令。想直接呼出它，可以在 Raycast Settings → Extensions 中找到该命令，设置一个未占用的快捷键，例如 **⌥ ⇧ F**。

## 结果操作

- **在 Finder 中打开**：选中文件时会在 Finder 中定位它；选中文件夹时会进入该文件夹。
- **快速查看**：在 Raycast 内预览选中项。
- **拷贝文件 / 拷贝文件夹**：把选中项放入剪贴板，可在 Finder 中粘贴。**拷贝名称**只复制名称（含扩展名）；**复制路径**复制完整路径。
- **在终端中打开**：使用 macOS Terminal 打开选中的文件夹，或文件所在的目录。
- **仅在此目录搜索**：进入新的搜索页，范围包含子目录。选中文件时取其所在目录；按 Esc 可返回之前的结果。含空格的目录或复杂匹配模式可能受 Lokii 返回条数上限影响。

## 搜索示例

| 输入 | 用途 |
| --- | --- |
| `README` | 按文件名搜索 |
| `src/main.rs` | 按路径片段搜索 |
| `*.pdf` | 用通配符匹配文件名 |

匹配、排序和索引范围由 Lokii 决定。命令只显示 Lokii 返回的结果。

## 故障排查

- **无法连接**：打开 Lokii 并保持运行。可以在终端执行下面的命令，验证本地服务是否能返回一行 JSON：
  
  ```sh
  printf '%s\n' '{"q":"README","mode":"auto","limit":1}' | nc -w 3 -U ~/.config/lokii/query.sock
  ```
- **连接成功但没有结果**：先在 Lokii 本身搜索同一个文件。若也找不到，请检查索引目录、排除规则及读取权限；首次建立索引时，可稍后重试。空结果本身不能判断索引是否已就绪。
- **找不到 Raycast 命令**：检查 `npm run dev` 是否报告编译错误，或在 Raycast 中通过 **Import Extension** 选择本项目目录。详见 [Raycast 开发环境说明](https://developers.raycast.com/basics/getting-started)。

## 开发验证

```sh
npm run lint
npm test
npm run typecheck
npm run build
```

协议参考：[Lokii 查询服务源码](https://github.com/huangy7/lokii/blob/main/lokii-core/src/query_server.rs)。
