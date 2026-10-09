# Spec: App Windows Instalador (NSIS)

> feature: app-windows-instalador
> status: planejado
> data: 2026-10-08

## Contexto

O aplicativo desktop do caixa (`espetinho-vitoria-caixa`) atualmente era empacotado no formato `portable` do Electron. 
No formato portátil, a cada execução o Windows precisa descompactar mais de 240 MB de arquivos binários em `%TEMP%`, provocando varredura contínua do Windows Defender e gerando uma lentidão de 30 a 45 segundos para a abertura do PDV.

Além disso, o executável necessita de identidade visual oficial da marca, utilizando o ícone de alta resolução fornecido (`public/Ícone Espetinho 100px (1).png`), atalhos automáticos na Área de Trabalho e Menu Iniciar, e inicialização instantânea (1 a 2 segundos) a partir do disco local instalado.

**Restrição Crítica do Usuário:** O subsistema de impressão térmica e as rotinas de impressão NÃO devem ser alterados nesta etapa.

---

## Histórias de Usuário & Critérios de Aceite

### US-001 — Instalação e Execução Instantânea no Windows

Como operador do caixa, quero instalar o aplicativo uma única vez no computador e abri-lo instantaneamente pela Área de Trabalho, para iniciar o atendimento sem atrasos.

#### AC-001 — Pacote Instalador Oficial NSIS
- **Dado** o projeto configurado com `electron-builder`
- **Quando** o comando de build `npm run electron:build` for executado
- **Então** deve ser gerado um executável de instalação no formato NSIS (`dist-electron/*Setup*.exe`) de 64 bits.

#### AC-002 — Atalhos Automáticos no Sistema Operacional
- **Dado** que o instalador foi executado no Windows
- **Quando** a instalação for concluída
- **Então** deve existir um atalho na Área de Trabalho e no Menu Iniciar com o nome "Espetinho Vitória - Caixa".

#### AC-003 — Tempo de Inicialização Sub-3-Segundos
- **Dado** o aplicativo instalado no disco local
- **Quando** o operador der dois cliques no atalho da Área de Trabalho
- **Então** o executável deve iniciar diretamente do diretório instalado sem processo de descompactação temporária, abrindo a janela em menos de 3 segundos.

---

### US-002 — Identidade Visual e Ícone Multi-Resolução

Como proprietário do estabelecimento, quero que o ícone oficial da marca apareça com máxima nitidez no executável, no instalador, na barra de tarefas e nos atalhos do Windows.

#### AC-004 — Ícone `.ico` Multi-Camada Nativo
- **Dado** a imagem fonte `public/Ícone Espetinho 100px (1).png`
- **Quando** o pipeline de ícones for processado
- **Então** o arquivo `electron/icon.ico` deve conter todas as resoluções padrão do Windows (256x256, 128x128, 64x64, 48x48, 32x32, 16x16).

#### AC-005 — Aplicação do Ícone no Instalador e Janela
- **Dado** a configuração do `electron-builder` e do `main.cjs`
- **Quando** o executável for gerado
- **Então** o instalador, o desinstalador, o atalho e a janela devem exibir o ícone oficial.

---

### US-003 — Resiliência e UX da Janela Desktop

Como operador do caixa, quero uma experiência suave durante a inicialização do app, sem telas brancas piscando e com proteção contra abertura múltipla.

#### AC-006 — Cor de Fundo Harmoniosa (Sem Flash Branco)
- **Dado** o `BrowserWindow` criado no `electron/main.cjs`
- **Quando** a janela é inicializada antes do término do carregamento da web
- **Então** a cor de fundo (`backgroundColor`) deve ser `#1a1a2e`, combinando com a identidade visual do painel admin.

#### AC-007 — Proteção de Instância Única
- **Dado** o aplicativo já em execução no Windows
- **Quando** o usuário tentar abrir um segundo atalho
- **Então** o app não abre processo duplicado; ele restaura e foca na janela já existente.

#### AC-008 — Preservação Intocada do Subsistema de Impressão
- **Dado** a implementação do `electron/main.cjs`, `preload.cjs` e `OrdersPage.jsx`
- **Quando** as alterações do instalador forem aplicadas
- **Então** nenhuma linha da lógica de impressão (`print-receipt`, `get-printers`, `autoPrintOrder`) deve ser alterada ou desestabilizada.

---

## Fora de Escopo

- Alterações na lógica de impressão térmica ou recibo.
- Mudanças no fluxo web do cliente ou do painel admin.
- Assinatura digital com certificado EV pago (usará assinatura auto-assinada/padrão do electron-builder para distribuição local).
