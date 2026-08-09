// @ts-check

/**
 * @typedef {Object} Settings
 * @property {string} language
 * @property {boolean} alwaysShowAdvanced
 * @property {string} customFilenameFormat
 * @property {boolean} rememberOptions
 * @property {boolean} defaultOutputPath
 * @property {boolean} workflowKeepModels
 * @property {'png'|'oxipng'|'webp'} imageEncoder
 * @property {number} pngCompressionLevel
 * @property {number} oxipngCompressionLevel
 * @property {number} webpCompressionLevel
 * @property {string} quickWorkflowName
 * @property {string} [rememberedGPU]
 * @property {Record<string, string>} [rememberedModels]
 * @property {number} [rememberedTileSize]
 * @property {boolean} [rememberedSkipAlpha]
 */
/** @typedef {{name: string, algo: string, scale: number, displayName: string}} ModelInfo */
/** @typedef {{supported: boolean, registered: boolean}} ContextMenuStatus */
/** @typedef {{status: string, sourcePath: string, workflowName: string, outputPath: string, progress: number, progressText: string, totalProgressText: string, error: string, queueLength: number, language: string}} QuickState */
/**
 * @typedef {Object} InferenceParams
 * @property {string} modelName
 * @property {number} tileSize
 * @property {number} scale
 * @property {boolean} isSkipAlpha
 * @property {string} resizeTo
 * @property {string} inputType
 * @property {string} inputImage
 * @property {string} outputPath
 * @property {string} gpuid
 * @property {string} algoName
 * @property {string} scalingMode
 * @property {string} [targetResolution]
 */
/**
 * @typedef {Object} MoeBridge
 * @property {(method: string, params?: Record<string, any>) => Promise<any>} call
 * @property {(callback: (...args: any[]) => void, name: string) => () => void} expose
 * @property {{selectPath: (mode: 'file'|'folder') => Promise<{path: string, type: string}|null>, showError: (message: string) => Promise<void>}} dialog
 * @property {{getStatus: () => Promise<ContextMenuStatus>, register: () => Promise<ContextMenuStatus>, unregister: () => Promise<ContextMenuStatus>}} contextMenu
 * @property {{getState: () => Promise<QuickState>, onStateChange: (callback: (state: QuickState) => void) => () => void}} quick
 */

const bridge = /** @type {{moeAPI: MoeBridge}} */ (window).moeAPI

/** @returns {Promise<Settings>} */
export function getSettings() {
  return bridge.call('py_get_settings')
}

/** @param {Settings} settings @returns {Promise<number>} */
export function saveSettings(settings) {
  return bridge.call('py_save_settings', { settings })
}

/** @param {string} algoName @returns {Promise<string[]>} */
export function getModelList(algoName) {
  return bridge.call('py_get_model_list', { algoName })
}

/** @returns {Promise<ModelInfo[]>} */
export function getAllModels() {
  return bridge.call('py_get_all_models')
}

/** @returns {Promise<string[]>} */
export function getGpuList() {
  return bridge.call('py_get_gpu_list')
}

/** @returns {Promise<string[]>} */
export function getWorkflowList() {
  return bridge.call('py_get_workflow_list')
}

/** @param {string} name @returns {Promise<Record<string, any>|null>} */
export function loadWorkflow(name) {
  return bridge.call('py_load_workflow', { name })
}

/** @param {string} name @param {Record<string, any>} data @returns {Promise<boolean>} */
export function saveWorkflow(name, data) {
  return bridge.call('py_save_workflow', { name, data })
}

/** @param {InferenceParams} params @returns {Promise<void>} */
export function runProcess(params) {
  return bridge.call('py_run_process', params)
}

/** @param {Record<string, any>} workflowData @returns {Promise<void>} */
export function runWorkflow(workflowData) {
  return bridge.call('py_run_workflow', { workflowData })
}

/** @param {(...args: any[]) => void} callback @param {'handleSetProgress'|'showError'|'handleSetProcessState'} name @returns {() => void} */
export function expose(callback, name) {
  return bridge.expose(callback, name)
}

/** @param {'file'|'folder'} mode */
export function openFileOrFolder(mode) {
  return bridge.dialog.selectPath(mode)
}

/** @param {string} message */
export function showErrorDialog(message) {
  return bridge.dialog.showError(message)
}

/** @returns {Promise<ContextMenuStatus>} */
export function getContextMenuStatus() {
  return bridge.contextMenu.getStatus()
}

/** @returns {Promise<ContextMenuStatus>} */
export function registerContextMenu() {
  return bridge.contextMenu.register()
}

/** @returns {Promise<ContextMenuStatus>} */
export function unregisterContextMenu() {
  return bridge.contextMenu.unregister()
}

/** @returns {Promise<QuickState>} */
export function getQuickState() {
  return bridge.quick.getState()
}

/** @param {(state: QuickState) => void} callback @returns {() => void} */
export function onQuickStateChange(callback) {
  return bridge.quick.onStateChange(callback)
}
