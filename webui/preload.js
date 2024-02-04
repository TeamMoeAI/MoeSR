const { dialog } = require('@electron/remote')

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'png'] }
    ]
  })
  if (!canceled) {
    return filePaths[0]
  }
  else{
    return ''
  }
}

async function handleFolderOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (!canceled) {
    return filePaths[0]
  }
  else{
    return ''
  }
}
async function handleErrorOpen(content){
  dialog.showErrorBox('Error', content)
}

window.electronAPI = {
  openFile: () => handleFileOpen(),
  openFolder: () => handleFolderOpen(),
  showError:(content) =>handleErrorOpen(content)
}