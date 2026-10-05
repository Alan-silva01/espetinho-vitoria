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
    frame: false,                    // Remove a barra de título nativa do Windows
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,        // Segurança: React não acessa Node diretamente
      nodeIntegration: false,        // Segurança: desabilita Node no renderer
      backgroundThrottling: false,   // Mantém Realtime do Supabase ativo quando minimizado
    },
  })

  mainWindow.removeMenu()

  mainWindow.loadURL(ADMIN_URL)

  // ── Injeta barra de título customizada após a página carregar ────────────
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        if (document.getElementById('electron-titlebar')) return;

        const style = document.createElement('style');
        style.textContent = \`
          #electron-titlebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 32px;
            background: #1a1a2e;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            -webkit-app-region: drag;
            user-select: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }
          #electron-titlebar .titlebar-title {
            font-family: 'Segoe UI', -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: #e0e0e0;
            letter-spacing: 0.5px;
          }
          #electron-titlebar .titlebar-buttons {
            position: absolute;
            right: 0;
            top: 0;
            height: 100%;
            display: flex;
            -webkit-app-region: no-drag;
          }
          #electron-titlebar .titlebar-btn {
            width: 46px;
            height: 100%;
            border: none;
            background: transparent;
            color: #aaa;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, color 0.15s;
          }
          #electron-titlebar .titlebar-btn:hover {
            background: rgba(255,255,255,0.08);
            color: #fff;
          }
          #electron-titlebar .titlebar-btn.close:hover {
            background: #e81123;
            color: #fff;
          }
          body {
            padding-top: 32px !important;
          }
        \`;
        document.head.appendChild(style);

        const bar = document.createElement('div');
        bar.id = 'electron-titlebar';
        bar.innerHTML = \`
          <span class="titlebar-title">Espetinho Vitória</span>
          <div class="titlebar-buttons">
            <button class="titlebar-btn" id="titlebar-min" title="Minimizar">&#x2014;</button>
            <button class="titlebar-btn" id="titlebar-max" title="Maximizar">&#x25A1;</button>
            <button class="titlebar-btn close" id="titlebar-close" title="Fechar">&#x2715;</button>
          </div>
        \`;
        document.body.prepend(bar);

        document.getElementById('titlebar-min').addEventListener('click', () => {
          window.electronAPI?.minimizeWindow();
        });
        document.getElementById('titlebar-max').addEventListener('click', () => {
          window.electronAPI?.maximizeWindow();
        });
        document.getElementById('titlebar-close').addEventListener('click', () => {
          window.electronAPI?.closeWindow();
        });
      })()
    `);
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
