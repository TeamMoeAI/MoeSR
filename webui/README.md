# MoeSR Electron

本目录包含 MoeSR 的 Electron 桌面界面。以下命令均在 `webui` 目录中执行。

## 常用命令

安装依赖：

```bash
npm install
```

启动开发模式：

```bash
npm run dev
```

开发时也可以先自行启动 Python 后端，再启动 Electron 调试模式：

```bash
npm run dev:debug
```

构建 Electron 代码到 `out/`：

```bash
npm run build
```

生成未压缩的应用目录：

```bash
npm run package
```

生成 Windows ZIP 发布包：

```bash
npm run dist
```

构建输出位于 `webui/release/`。

## 打包前需要补齐的资源

以下路径相对于仓库根目录。它们当前不由 Git 跟踪，但生成完整发布包前需要存在：

- `runtime/`：完整的随附运行时，其中应包含 `runtime/python.exe`。
- `gpu_enum.dll`：GPU 枚举组件。
- `webui/build/icon.png`：Windows 应用图标。
- `webui/src/renderer/public/NotoSerifSC-Regular-subset.woff2`：界面字体。
- `MoeSRData/models/Place models here.txt`：随发布包创建模型目录的占位文件。

当前打包配置不会附带模型文件，只会在发布包的 `MoeSRData/models/` 中放入上述占位文件。
