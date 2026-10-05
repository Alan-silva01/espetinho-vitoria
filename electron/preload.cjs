/**
 * electron/preload.js — Ponte Segura entre o React e o Windows
 *
 * O que faz:
 *  - Expõe funções nativas do Electron para o React de forma controlada
 *  - contextBridge garante que o React não tem acesso livre ao Node/filesystem
 *  - O React usa window.electronAPI?.printReceipt() com optional chaining,
 *    então se o app estiver num navegador comum (celular, Chrome), o código
 *    simplesmente ignora e segue o caminho padrão, sem erros.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Sinaliza para o React que está rodando dentro do app desktop
  isElectron: true,

  // Lista as impressoras instaladas no Windows
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // Envia o HTML do recibo para impressão silenciosa nativa
  // Retorna: { success: boolean, error?: string }
  printReceipt: (html, printerName) =>
    ipcRenderer.invoke('print-receipt', html, printerName),
})
