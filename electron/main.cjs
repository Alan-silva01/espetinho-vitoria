/**
 * electron/main.js — Motor do App de Caixa (Espetinho Vitória)
 *
 * O que faz:
 *  - Abre uma janela Windows que carrega o painel admin da Vercel
 *  - Fornece impressão térmica 100% silenciosa via driver nativo do Windows
 *  - Garante instância única (evita impressão duplicada)
 *  - Mantém o app sempre acordado (Realtime do Supabase nunca congela)
 *  - Inicia automaticamente com o Windows
 *  - Bloqueia suspensão de energia durante o expediente
 *  - Bloqueia navegação para domínios externos
 */

const {
  app,
  BrowserWindow,
  ipcMain,
  powerSaveBlocker,
} = require('electron')
const path = require('path')

// ── URL do painel admin ──────────────────────────────────────────────────────
// Em desenvolvimento, carrega o Vite local.
// Em produção (exe no caixa), carrega a Vercel diretamente.
const ADMIN_URL = app.isPackaged
  ? 'https://espetinho-vitoria.vercel.app/admin/pedidos'
  : 'http://localhost:5173/admin/pedidos'

// ── Instância única: evita dois caixas abertos imprimindo em dobro ───────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow = null

// ── Criar a janela principal do caixa ────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Espetinho Vitória — Caixa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,        // Segurança: React não acessa Node diretamente
      nodeIntegration: false,        // Segurança: desabilita Node no renderer
      backgroundThrottling: false,   // Mantém Realtime do Supabase ativo quando minimizado
    },
  })

  mainWindow.loadURL(ADMIN_URL)

  // Bloqueia navegação para qualquer domínio externo ao Espetinho Vitória
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = ['espetinho-vitoria.vercel.app', 'localhost']
    const isAllowed = allowed.some(domain => url.includes(domain))
    if (!isAllowed) {
      event.preventDefault()
      console.warn('[Segurança] Navegação bloqueada para:', url)
    }
  })
}

app.whenReady().then(() => {
  // ── Iniciar com o Windows ─────────────────────────────────────────────────
  app.setLoginItemSettings({ openAtLogin: true })

  // ── Bloquear suspensão de energia durante o expediente ───────────────────
  powerSaveBlocker.start('prevent-app-suspension')

  createWindow()
})

// ── Se tentar abrir uma segunda instância, foca na que já está aberta ────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC: Listar impressoras do Windows ───────────────────────────────────────
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return []
  const printers = await mainWindow.webContents.getPrintersAsync()
  return printers.map(p => p.name)
})

// ── IPC: Imprimir recibo de forma silenciosa ──────────────────────────────────
// Cria uma janela oculta em segundo plano, injeta o HTML do recibo
// e envia direto ao driver da impressora térmica sem abrir nenhum diálogo.
ipcMain.handle('print-receipt', async (_event, html, printerName) => {
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    printWin.webContents.once('did-finish-load', () => {
      printWin.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName || '',   // deviceName é o nome correto da API do Electron
          margins: { marginType: 'none' }, // Sem margens extras do Windows
        },
        (success, failureReason) => {
          printWin.close()
          if (success) {
            console.log('[ElectronPrint] ✅ Impresso com sucesso na:', printerName)
            resolve({ success: true })
          } else {
            console.error('[ElectronPrint] ❌ Falha:', failureReason)
            resolve({ success: false, error: failureReason })
          }
        }
      )
    })
  })
})
