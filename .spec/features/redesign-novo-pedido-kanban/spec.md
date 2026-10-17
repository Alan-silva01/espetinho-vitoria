# Spec: Redesign novo pedido kanban

> feature: redesign-novo-pedido-kanban
> status: pronta

## Contexto

Modernizar e padronizar o modal de criação de novo pedido para cliente (`CreateOrderModal`) no painel administrativo Kanban, alinhando-o estritamente com o Design System oficial do sistema (barra de topo `#232220`, botão verde de ação, exibição de foto real do cliente, formatação de telefone sem `@s.whatsapp.net` e barra flutuante de retorno rápido ao painel administrativo quando aberto pelo admin).

## Histórias

### US-012 — Interface padronizada e moderna para iniciar novo pedido no Kanban

Como operador do painel administrativo,
quero abrir o modal de novo pedido com a mesma identidade visual de recibo do sistema, visualizar a foto e telefone formatado do cliente, acionar o pedido com botão verde e ter uma forma simples de voltar ao admin caso desista de montar o pedido,
para que a experiência seja rápida, visualmente agradável e sem bloqueios de navegação.

#### AC-049 — Cabeçalho do modal segue o tema de recibo com barra escura #232220 e sem emojis

- **Dado** o operador no painel de pedidos / Kanban
- **Quando** clica no botão "Novo Pedido"
- **Então** o modal exibe a barra superior com cor de fundo `#232220`, título institucional sem emojis e botão fechar elegante

#### AC-050 — Campo de busca com ícone integrado e foco no padrão #232220

- **Dado** o modal de novo pedido aberto
- **Quando** o operador visualiza o campo de busca de cliente
- **Então** o input possui tipografia Inter, borda neutra e foco na tonalidade escura institucional, permitindo digitar nome, código ou telefone

#### AC-051 — Botão 'Iniciar Pedido' na cor verde

- **Dado** a lista de clientes encontrados na busca
- **Quando** os resultados são renderizados
- **Então** o botão de ação 'Iniciar Pedido' utiliza cor de destaque verde `#16A34A` / `#15803D`

#### AC-052 — Foto do cliente renderizada no avatar com fallback de inicial

- **Dado** um cliente que possui `avatr_url` no cadastro ou `avatar_url` em seus dados
- **Quando** é listado no resultado de busca
- **Então** a imagem da foto do cliente é carregada no avatar circular/quadrado e, se não houver foto, exibe a inicial do nome com elegância

#### AC-053 — Telefone do cliente limpo e formatado como em Clientes

- **Dado** o telefone do cliente armazenado no banco com formato WhatsApp (ex: `559991372552@s.whatsapp.net` ou dígitos crus)
- **Quando** é exibido no card do cliente
- **Então** o sufixo `@s.whatsapp.net` e DDI 55 são tratados e o número é formatado no padrão legível `(99) 99999-9999`

#### AC-054 — Banner flutuante no app do cliente para retornar ao Painel Admin

- **Dado** que o operador clicou em 'Iniciar Pedido' e foi direcionado para a tela de pedidos do cliente com `admin=true`
- **Quando** visualiza o cardápio ou qualquer página do cliente
- **Então** uma barra fixa discreta no topo avisa que está em modo de atendimento e fornece um botão para retornar imediatamente ao `/admin/pedidos` sem precisar concluir o pedido

## Fora de escopo

- Alteração da lógica de autenticação do cliente.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-002 | O fluxo de redirecionamento ou abertura do cardápio do cliente com token/dados é preservado integralmente | confirmada | Confirmado com a implementação atual de handleOpenCustomerApp |

## Perguntas em aberto

Nenhuma.
