import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import WebSocket from 'ws'

const currentDir = __dirname
const backendPort = 10721
const useExternalBackend = process.env.MOESR_EXTERNAL_BACKEND === '1'
const debugWindows = process.env.MOESR_DEBUG_WINDOWS === '1'
const execFileAsync = promisify(execFile)
const portableRoot = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : path.resolve(app.getAppPath(), '..')
const electronDataDir = path.join(portableRoot, 'electronData')
const moeSRDataDir = path.join(portableRoot, 'MoeSRData')
const crashDumpsDir = path.join(electronDataDir, 'crashDumps')
const logsDir = path.join(electronDataDir, 'logs')

for (const directory of [electronDataDir, moeSRDataDir, crashDumpsDir, logsDir]) {
  mkdirSync(directory, { recursive: true })
}

app.setPath('userData', electronDataDir)
app.setPath('sessionData', electronDataDir)
app.setPath('crashDumps', crashDumpsDir)
app.setAppLogsPath(logsDir)

const processMethods = new Set([
  'py_run_process',
  'py_run_workflow',
  'py_run_quick_workflow',
])
const contextMenuTargets = [
  'SystemFileAssociations\\.jpg',
  'SystemFileAssociations\\.jpeg',
  'SystemFileAssociations\\.png',
  'SystemFileAssociations\\.webp',
  'Directory',
]

function parseQuickRequest(argv) {
  const flagIndex = argv.indexOf('--quick-process')
  if (flagIndex < 0 || typeof argv[flagIndex + 1] !== 'string') return null
  return { sourcePath: path.resolve(argv[flagIndex + 1]) }
}

const initialQuickRequest = parseQuickRequest(process.argv)
const gotSingleInstanceLock = app.requestSingleInstanceLock({
  quickRequest: initialQuickRequest,
})

if (!gotSingleInstanceLock) app.quit()

const allowedMethods = new Set([
  'py_get_model_list',
  'py_get_all_models',
  'py_get_gpu_list',
  'py_get_settings',
  'py_save_settings',
  'py_get_workflow_list',
  'py_load_workflow',
  'py_save_workflow',
  'py_run_process',
  'py_run_workflow',
  'py_run_quick_workflow',
])

const allowedCallbacks = new Set([
  'handleSetProgress',
  'showError',
  'showWarning',
  'handleSetProcessState',
])

let mainWindow = null
let quickWindow = null
let pythonProcess = null
let backendSocket = null
let requestSequence = 0
let isQuitting = false
let backendReady = false
let openMainWhenReady = false
let activeProcessSource = null
let processTail = Promise.resolve()
let quickQueueRunning = false
let currentQuickTask = null
const quickTaskQueue = []
let quickState = {
  status: 'idle',
  sourcePath: '',
  workflowName: '',
  outputPath: '',
  progress: 0,
  progressText: '',
  totalProgressText: '',
  error: '',
  queueLength: 0,
  language: 'English',
}

/** @type {Map<string, {resolve: (value: unknown) => void, reject: (reason?: unknown) => void}>} */
const pendingRequests = new Map()

function getRuntimePaths() {
  if (app.isPackaged) {
    return {
      pythonExecutable: path.join(process.resourcesPath, 'runtime', 'python.exe'),
      backendScript: path.join(process.resourcesPath, 'python', 'backend_server.py'),
    }
  }

  const repositoryRoot = path.resolve(app.getAppPath(), '..')
  const embeddedPython = path.join(repositoryRoot, 'runtime', 'python.exe')

  return {
    pythonExecutable: existsSync(embeddedPython)
      ? embeddedPython
      : (process.env.MOESR_PYTHON || 'python'),
    backendScript: path.join(repositoryRoot, 'backend_server.py'),
  }
}

function startPythonBackend() {
  const paths = getRuntimePaths()

  if (!existsSync(paths.backendScript)) {
    throw new Error(`Python backend not found: ${paths.backendScript}`)
  }

  if (app.isPackaged && !existsSync(paths.pythonExecutable)) {
    throw new Error(`Embedded Python not found: ${paths.pythonExecutable}`)
  }

  pythonProcess = spawn(
    paths.pythonExecutable,
    [
      '-u',
      paths.backendScript,
      '--port', String(backendPort),
      '--data-dir', moeSRDataDir,
    ],
    {
      cwd: path.dirname(paths.backendScript),
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  pythonProcess.stdout.on('data', data => {
    console.log(`[Python] ${data.toString().trimEnd()}`)
  })

  pythonProcess.stderr.on('data', data => {
    console.error(`[Python] ${data.toString().trimEnd()}`)
  })

  pythonProcess.on('error', error => {
    console.error('Failed to start Python backend:', error)
  })

  pythonProcess.on('exit', code => {
    pythonProcess = null
    backendSocket = null
    rejectPendingRequests(new Error(`Python backend exited with code ${code}`))

    if (!isQuitting && currentQuickTask) {
      updateQuickState({
        status: 'error',
        error: `Python backend exited with code ${code}`,
      })
    } else if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend:callback', {
        type: 'js_call',
        name: 'showError',
        args: [`Python backend exited with code ${code}`],
      })
    }
  })
}

function connectOnce() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${backendPort}`)
    let settled = false

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        socket.terminate()
        reject(new Error('Backend connection timed out'))
      }
    }, 500)

    socket.once('open', () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      backendSocket = socket
      setupBackendSocket(socket)
      resolve()
    })

    socket.once('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.terminate()
      reject(error)
    })
  })
}

async function connectBackend() {
  let lastError

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await connectOnce()
      return
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  throw lastError || new Error('Could not connect to Python backend')
}

function setupBackendSocket(socket) {
  socket.on('message', raw => {
    let message

    try {
      message = JSON.parse(raw.toString())
    } catch (error) {
      console.error('Invalid backend message:', error)
      return
    }

    if (message.type === 'response') {
      const pending = pendingRequests.get(message.id)
      if (!pending) return

      pendingRequests.delete(message.id)

      if (message.error) {
        pending.reject(new Error(message.error.message || 'Backend error'))
      } else {
        pending.resolve(message.result)
      }
      return
    }

    if (
      message.type === 'js_call' &&
      allowedCallbacks.has(message.name)
    ) {
      if (message.name === 'showWarning') {
        void dialog.showMessageBox({
          type: 'warning',
          title: 'Warning',
          message: String(message.args?.[0] || 'Python backend warning'),
        })
        return
      }

      if (activeProcessSource === 'quick') {
        updateQuickStateFromBackend(message)
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend:callback', message)
      }
    }
  })

  socket.on('error', error => {
    console.error('Backend WebSocket error:', error)
  })

  socket.on('close', () => {
    if (backendSocket === socket) backendSocket = null
    rejectPendingRequests(new Error('Backend connection closed'))
  })
}

function callPython(method, params = {}) {
  if (!allowedMethods.has(method)) {
    return Promise.reject(new Error(`Backend method is not allowed: ${method}`))
  }

  if (!backendSocket || backendSocket.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Python backend is not connected'))
  }

  const id = String(++requestSequence)

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    backendSocket.send(JSON.stringify({ type: 'request', id, method, params }))
  })
}

function callBackend(method, params = {}, source = 'renderer', onStart) {
  if (!processMethods.has(method)) return callPython(method, params)

  const run = async () => {
    activeProcessSource = source
    onStart?.()
    try {
      return await callPython(method, params)
    } finally {
      activeProcessSource = null
    }
  }

  const result = processTail.then(run, run)
  processTail = result.catch(() => undefined)
  return result
}

function rejectPendingRequests(error) {
  for (const request of pendingRequests.values()) request.reject(error)
  pendingRequests.clear()
}

function updateQuickState(patch) {
  quickState = { ...quickState, ...patch }
  if (quickWindow && !quickWindow.isDestroyed()) {
    quickWindow.webContents.send('quick:state', quickState)
  }
}

function updateQuickStateFromBackend(message) {
  if (!currentQuickTask || activeProcessSource !== 'quick') return

  if (message.name === 'handleSetProgress') {
    updateQuickState({
      progress: Number(message.args?.[0] || 0),
      progressText: String(message.args?.[1] || ''),
      totalProgressText: String(message.args?.[2] || ''),
    })
    return
  }

  if (message.name === 'showError') {
    updateQuickState({
      status: 'error',
      error: String(message.args?.[0] || 'Quick process failed'),
      progressText: '',
    })
    return
  }

  if (message.name === 'handleSetProcessState') {
    const state = message.args?.[0]
    if (state === 'finish') {
      updateQuickState({ status: 'finish', progress: 100, progressText: '' })
    } else if (state === 'error') {
      updateQuickState({ status: 'error', progressText: '' })
    }
  }
}

function getQuickOutputPath(sourcePath) {
  const info = statSync(sourcePath)
  return info.isDirectory()
    ? path.join(sourcePath, 'MoeSR_output')
    : path.join(path.dirname(sourcePath), 'MoeSR_output')
}

function enqueueQuickTask(request) {
  if (!request?.sourcePath) return
  quickTaskQueue.push({ sourcePath: path.resolve(request.sourcePath) })
  updateQuickState({ queueLength: quickTaskQueue.length + (currentQuickTask ? 1 : 0) })

  if (app.isReady()) createQuickWindow()
  if (backendReady) void runQuickTaskQueue()
}

async function runQuickTaskQueue() {
  if (quickQueueRunning || !backendReady) return
  quickQueueRunning = true

  try {
    while (quickTaskQueue.length > 0 && !isQuitting) {
      currentQuickTask = quickTaskQueue.shift()
      updateQuickState({
        status: 'starting',
        sourcePath: currentQuickTask.sourcePath,
        workflowName: '',
        outputPath: '',
        progress: 0,
        progressText: '',
        totalProgressText: '',
        error: '',
        queueLength: quickTaskQueue.length + 1,
      })

      try {
        if (!existsSync(currentQuickTask.sourcePath)) {
          throw new Error(`Input path not found: ${currentQuickTask.sourcePath}`)
        }

        const settings = await callPython('py_get_settings')
        const workflowName = settings.quickWorkflowName
        if (!workflowName) throw new Error('No workflow selected for quick processing')

        updateQuickState({
          status: 'queued',
          workflowName,
          outputPath: getQuickOutputPath(currentQuickTask.sourcePath),
          language: settings.language || 'English',
        })

        await callBackend(
          'py_run_quick_workflow',
          {
            workflowName,
            sourcePath: currentQuickTask.sourcePath,
          },
          'quick',
          () => updateQuickState({ status: 'running' }),
        )

        if (quickState.status !== 'error') {
          updateQuickState({ status: 'finish', progress: 100, progressText: '' })
        }
      } catch (error) {
        updateQuickState({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          progressText: '',
        })
      } finally {
        currentQuickTask = null
        updateQuickState({ queueLength: quickTaskQueue.length })
      }
    }
  } finally {
    quickQueueRunning = false
  }
}

function getContextMenuKeys() {
  return contextMenuTargets.map(target => (
    `HKCU\\Software\\Classes\\${target}\\shell\\MoeSR`
  ))
}

async function registryKeyExists(key) {
  try {
    await execFileAsync('reg.exe', ['QUERY', key])
    return true
  } catch {
    return false
  }
}

async function getContextMenuStatus() {
  const supported = process.platform === 'win32'
  if (!supported) return { supported, registered: false }

  const keyStates = await Promise.all(getContextMenuKeys().map(registryKeyExists))
  return { supported, registered: keyStates.every(Boolean) }
}

async function unregisterContextMenu() {
  if (process.platform !== 'win32') return

  await Promise.all(getContextMenuKeys().map(async key => {
    try {
      await execFileAsync('reg.exe', ['DELETE', key, '/f'])
    } catch (error) {
      if (await registryKeyExists(key)) throw error
    }
  }))
}

async function registerContextMenu() {
  if (process.platform !== 'win32') {
    throw new Error('Context menu registration is only available on Windows')
  }

  const executable = process.execPath
  const command = app.isPackaged
    ? `"${executable}" --quick-process "%1"`
    : `"${executable}" "${app.getAppPath()}" --quick-process "%1"`

  try {
    for (const key of getContextMenuKeys()) {
      await execFileAsync('reg.exe', ['ADD', key, '/ve', '/d', '使用 MoeSR 超分', '/f'])
      await execFileAsync('reg.exe', ['ADD', key, '/v', 'Icon', '/d', `${executable},0`, '/f'])
      await execFileAsync('reg.exe', ['ADD', `${key}\\command`, '/ve', '/d', command, '/f'])
    }
  } catch (error) {
    await unregisterContextMenu()
    throw error
  }
}

function registerIpcHandlers() {
  ipcMain.handle('backend:call', (_event, request) => {
    if (!request || typeof request.method !== 'string') {
      throw new Error('Invalid backend request')
    }
    return callBackend(request.method, request.params || {})
  })

  ipcMain.handle('dialog:select-path', async (_event, mode) => {
    if (!['file', 'folder'].includes(mode)) throw new Error('Invalid selection mode')

    const result = await dialog.showOpenDialog({
      properties: mode === 'folder' ? ['openDirectory'] : ['openFile'],
      filters: mode === 'file'
        ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
        : [],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    return {
      path: result.filePaths[0],
      type: mode === 'folder' ? 'directory' : 'file',
    }
  })

  ipcMain.handle('dialog:show-error', (_event, content) => {
    dialog.showErrorBox('Error', String(content))
  })

  ipcMain.handle('context-menu:get-status', () => getContextMenuStatus())
  ipcMain.handle('context-menu:register', async () => {
    await registerContextMenu()
    return getContextMenuStatus()
  })
  ipcMain.handle('context-menu:unregister', async () => {
    await unregisterContextMenu()
    return getContextMenuStatus()
  })

  ipcMain.handle('quick:get-state', () => quickState)
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: process.env.MOESR_SMOKE_TEST !== '1',
    title: 'MoeSR',
    ...(!app.isPackaged && {
      icon: path.join(app.getAppPath(), 'resources', 'icon.png'),
    }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDir, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(currentDir, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

function createQuickWindow() {
  if (quickWindow && !quickWindow.isDestroyed()) {
    if (quickWindow.isMinimized()) quickWindow.restore()
    quickWindow.focus()
    return quickWindow
  }

  quickWindow = new BrowserWindow({
    width: 560,
    height: 280,
    resizable: false,
    maximizable: false,
    show: process.env.MOESR_SMOKE_TEST !== '1',
    title: 'MoeSR 快捷处理',
    ...(!app.isPackaged && {
      icon: path.join(app.getAppPath(), 'resources', 'icon.png'),
    }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDir, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  quickWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL)
    rendererUrl.searchParams.set('mode', 'quick')
    quickWindow.loadURL(rendererUrl.toString())
  } else {
    quickWindow.loadFile(path.join(currentDir, '../renderer/index.html'), {
      query: { mode: 'quick' },
    })
  }

  quickWindow.webContents.on('did-finish-load', () => {
    quickWindow?.webContents.send('quick:state', quickState)
  })

  quickWindow.on('closed', () => {
    quickWindow = null
  })

  return quickWindow
}

function stopBackend() {
  backendReady = false
  rejectPendingRequests(new Error('Application is shutting down'))

  if (backendSocket) {
    backendSocket.close()
    backendSocket = null
  }

  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}

if (gotSingleInstanceLock) {
  app.on('second-instance', (_event, commandLine, _workingDirectory, additionalData) => {
    const quickRequest = additionalData?.quickRequest || parseQuickRequest(commandLine)
    if (quickRequest) {
      enqueueQuickTask(quickRequest)
      return
    }

    if (backendReady) {
      createMainWindow()
    } else {
      openMainWhenReady = true
    }
  })
}

app.whenReady().then(async () => {
  registerIpcHandlers()

  if (initialQuickRequest) enqueueQuickTask(initialQuickRequest)

  try {
    if (useExternalBackend) {
      console.log(`Using external Python backend at ws://127.0.0.1:${backendPort}`)
    } else {
      startPythonBackend()
    }
    await connectBackend()
    backendReady = true

    if (initialQuickRequest) {
      void runQuickTaskQueue()
    } else if (debugWindows) {
      const settings = await callPython('py_get_settings')
      updateQuickState({
        status: 'preview',
        sourcePath: 'C:\\Images\\example.png',
        workflowName: settings.quickWorkflowName || 'Debug Workflow',
        outputPath: 'C:\\Images\\MoeSR_output',
        progress: 42,
        progressText: '42% ETR:--:--:--',
        totalProgressText: '1/2 (42%)',
        error: '',
        language: settings.language || 'English',
      })
      createMainWindow()
      createQuickWindow()
      console.log('Debug mode: opened main and quick windows')
    } else {
      createMainWindow()
    }

    if (openMainWhenReady) createMainWindow()

    const contextMenuStatus = await getContextMenuStatus()
    if (contextMenuStatus.registered) {
      registerContextMenu().catch(error => {
        console.error('Failed to refresh context menu registration:', error)
      })
    }
  } catch (error) {
    if (quickWindow && !quickWindow.isDestroyed()) {
      updateQuickState({ status: 'error', error: String(error) })
    } else {
      dialog.showErrorBox('Backend startup failed', String(error))
      app.quit()
    }
  }
})

app.on('before-quit', () => {
  isQuitting = true
  stopBackend()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && backendSocket) createMainWindow()
})
