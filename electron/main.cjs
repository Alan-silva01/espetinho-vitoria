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
  Menu,
  ipcMain,
  powerSaveBlocker,
} = require('electron')
const path = require('path')

// ── Desativa menu padrão do sistema (File, Edit, View, Window) ───────────────
Menu.setApplicationMenu(null)

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
    icon: path.join(__dirname, 'icon.ico'), // Ícone oficial na barra de tarefas e Alt+Tab
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',            // Fundo 100% transparente: usa o fundo cinza claro da aplicação
      symbolColor: '#1a1a1a',        // Cor dos símbolos do Windows (minimizar, maximizar, fechar)
      height: 36,                    // Altura exata de 36px para casar com o respiro do topo
    },
    autoHideMenuBar: true,
    backgroundColor: '#EEEFF1',      // Fundo padrão claro da aplicação
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,        // Segurança: React não acessa Node diretamente
      nodeIntegration: false,        // Segurança: desabilita Node no renderer
      backgroundThrottling: false,   // Mantém Realtime do Supabase ativo quando minimizado
    },
  })

  mainWindow.removeMenu()

  mainWindow.loadURL(ADMIN_URL)

  // ── Área arrastável nativa no topo (36px) sem sobrepor botões ou elementos clicáveis ──
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      /* Área de arraste no topo de 36px para mover a janela */
      #electron-drag-region {
        position: fixed;
        top: 0;
        left: 0;
        right: 140px; /* Deixa livre os botões nativos do Windows no canto superior direito */
        height: 36px;
        -webkit-app-region: drag;
        z-index: 99998;
        pointer-events: none;
      }
      /* Garante que qualquer botão ou input abaixo continue clicável */
      button, input, select, a, [role="button"], .mobile-menu-toggle {
        -webkit-app-region: no-drag !important;
      }
    `).catch(() => {})

    mainWindow.webContents.executeJavaScript(`
      (function() {
        if (document.getElementById('electron-drag-region')) return;
        const dragDiv = document.createElement('div');
        dragDiv.id = 'electron-drag-region';
        document.body.prepend(dragDiv);
      })()
    `).catch(() => {})
  })


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

// ── IPC: Controle de janela (barra de título customizada) ────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())

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
