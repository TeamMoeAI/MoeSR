import { contextBridge, ipcRenderer } from 'electron'

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
  'handleSetProcessState',
])

contextBridge.exposeInMainWorld('moeAPI', {
  call(method, params = {}) {
    if (!allowedMethods.has(method)) {
      return Promise.reject(new Error(`Backend method is not allowed: ${method}`))
    }
    return ipcRenderer.invoke('backend:call', { method, params })
  },

  expose(callback, name) {
    if (typeof callback !== 'function') throw new TypeError('Callback must be a function')
    if (!allowedCallbacks.has(name)) throw new Error(`Callback is not allowed: ${name}`)

    const listener = (_event, message) => {
      if (message.name === name) callback(...(message.args || []))
    }

    ipcRenderer.on('backend:callback', listener)
    return () => ipcRenderer.removeListener('backend:callback', listener)
  },

  dialog: {
    selectPath(mode) {
      return ipcRenderer.invoke('dialog:select-path', mode)
    },

    showError(content) {
      return ipcRenderer.invoke('dialog:show-error', content)
    },
  },

  contextMenu: {
    getStatus() {
      return ipcRenderer.invoke('context-menu:get-status')
    },

    register() {
      return ipcRenderer.invoke('context-menu:register')
    },

    unregister() {
      return ipcRenderer.invoke('context-menu:unregister')
    },
  },

  quick: {
    getState() {
      return ipcRenderer.invoke('quick:get-state')
    },

    onStateChange(callback) {
      if (typeof callback !== 'function') throw new TypeError('Callback must be a function')
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('quick:state', listener)
      return () => ipcRenderer.removeListener('quick:state', listener)
    },
  },
})
