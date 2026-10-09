# Tasks: App Windows Instalador (NSIS)

> feature: app-windows-instalador

## T-001 — Gerar ícone multi-resolução (.ico) a partir do PNG oficial [concluida]

- Refs: US-002, AC-004, AC-005
- Arquivos: `electron/icon.ico`, `electron/icon.png`, `public/Ícone Espetinho 100px (1).png`
- Ação: Converter a imagem PNG oficial de 313x313 em um arquivo `.ico` contendo as 6 camadas de resolução do Windows (256, 128, 64, 48, 32, 16px) via `magick`.

## T-002 — Configurar electron-builder com target NSIS no package.json [concluida]

- Refs: US-001, AC-001, AC-002, AC-005
- Arquivos: `package.json`
- Ação: Ajustar `target: "nsis"`, definir `productName: "Espetinho Vitória - Caixa"`, configurar parâmetros do NSIS (atalho na área de trabalho, menu iniciar, ícone do instalador/desinstalador e desinstalação limpa).

## T-003 — Ajustar UX de carregamento e resiliência no electron/main.cjs [concluida]

- Refs: US-003, AC-006, AC-007, AC-008
- Arquivos: `electron/main.cjs`
- Ação: Adicionar `backgroundColor: '#1a1a2e'` e ícone no `BrowserWindow`. Garantir que a lógica de impressão (`print-receipt`, `get-printers`) permaneça 100% inalterada.

## T-004 — Compilar e validar o executável final de instalação [concluida]

- Refs: US-001, US-002, US-003, AC-001, AC-003
- Arquivos: `dist-electron/Espetinho Vitória - Caixa Setup 1.0.0.exe`
- Ação: Executar `npm run electron:build`, verificar geração do arquivo final sem erros e inspecionar integridade do pacote gerado.
