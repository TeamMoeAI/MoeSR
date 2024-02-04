const { app, BrowserWindow, screen, } = require('electron')
require('@electron/remote/main').initialize()
const path = require('node:path')
const url = require('url')

let mainWindow

function createWindow() {
    const { scaleFactor } = screen.getPrimaryDisplay();
    console.log(scaleFactor)
    // console.log(path.join(__dirname, 'preload.js'))
    mainWindow = new BrowserWindow(
        {
            width: 1024, height: 576,
            title: 'Moe SR',
            icon: path.join(__dirname, 'icon.png'),
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                contextIsolation: false,
                webSecurity: false,
                enableRemoteModule: true,
                preload: path.join(__dirname, 'preload.js')
            }
        }
    )
    require('@electron/remote/main').enable(mainWindow.webContents)
    mainWindow.loadURL('http://localhost:10721/');
    mainWindow.on('closed', function () {
        mainWindow = null
    })
}

app.whenReady().then(() => {
    createWindow()
})