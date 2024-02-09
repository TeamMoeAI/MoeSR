## 环境配置

### Clone此项目

```
git clone git@github.com:TeamMoeAI/MoeSR.git
```

### python环境配置

注：本项目使用了修改版的eel库，推荐创建新的虚拟环境来安装，避免影响到你的其他使用eel的项目

`MoeSR`项目根目录下执行：

```bash
pip install -r requirements.txt
```

### node环境配置

1. `MoeSR/webui`下执行：

```
npm install
```

2. 下载项目的静态文件并解压

   由于图片字体等非代码二进制文件体积较大，所以单独放置他们，而没有放在仓库中

   下载V1.0.0 Release中的`dev-webui.zip`然后解压至项目根目录下，正确解压后，此时你的webui文件夹中会多出config,scripts等文件夹。

## 开发相关

开发流程待优化，暂时比较混乱。

### Webui开发

1. 修改`webui/main.js` 29行处端口为3000
2. 修改`webui/src/App.js` 11行处`webDevMode`为true
3. 启动node 后端：`npm start`
4. 启动electron：`npm run electron-start`

### webui构建

1. 修改`webui/src/App.js` 11行处`webDevMode`为false
2. 执行`npm run build`
3. 为`index.html`添加eel引入，可在title标签后添加`<script type="text/javascript" src="eel.js"></script>`

### python后端开发

1. 完成webui构建后，运行`moe_sr_dev.py`

## 开发文档

Todo...
