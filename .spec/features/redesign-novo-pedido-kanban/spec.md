# Spec: Redesign novo pedido kanban

> feature: redesign-novo-pedido-kanban
> status: pronta

## Contexto

Modernizar e padronizar o modal de criação de novo pedido para cliente (`CreateOrderModal`) no painel administrativo Kanban, alinhando-o estritamente com o Design System oficial do sistema (barra de topo `#232220`, botão verde de ação, exibição de foto real do cliente, formatação de telefone sem `@s.whatsapp.net`, máscara dinâmica enquanto o usuário digita o WhatsApp, salvamento do novo cliente com telefone normalizado no formato padrão WhatsApp descartando o nono dígito `55{DDD}{8digitos}@s.whatsapp.net`, detecção amigável de duplicidade com busca do cliente existente e banner flutuante de retorno rápido ao painel administrativo quando aberto pelo admin).

## Histórias

### US-012 — Interface padronizada e moderna para iniciar novo pedido no Kanban

Como operador do painel administrativo,
quero abrir o modal de novo pedido com a mesma identidade visual de recibo do sistema, visualizar a máscara do telefone formatando dinamicamente enquanto digito, cadastrar clientes com telefone padronizado no formato WhatsApp oficial (descartando o nono dígito do DDD móvel no banco e mantendo legível em dados.whatsapp), receber modal amigável com botão direto para o cliente caso o número já exista e ter uma forma simples de voltar ao admin caso desista de montar o pedido,
para que a experiência seja rápida, visualmente agradável, sem bloqueios de navegação e sem alertas técnicos ou indecifráveis do banco de dados.

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

#### AC-055 — Normalização de telefone ao salvar novo cliente descartando o 3º número se for 9

- **Dado** o operador cadastrando um novo cliente e informando um número de 11 dígitos com DDD (ex: `99991372552` ou `(99) 99137-2552`)
- **Quando** o cadastro é enviado para o Supabase
- **Então** o terceiro dígito (o nono dígito '9') é descartado caso presente, gravando no campo `telefone` o formato `559991372552@s.whatsapp.net` e no campo `dados.whatsapp` a exibição formatada legível `(99) 99137-2552`

#### AC-056 — Máscara de telefone interativa enquanto digita (XX) 9XXXX-XXXX

- **Dado** o operador digitando no campo de WhatsApp do formulário de novo cliente
- **Quando** digita os números
- **Então** a máscara aplica dinamicamente o formato `(XX)` para os dois primeiros dígitos e `(XX) 9XXXX-XXXX` para 11 dígitos em tempo real

#### AC-057 — Tratamento de cliente já existente com modal amigável e botão 'Ir para o Cliente'

- **Dado** o operador tentando cadastrar um telefone que já existe no banco de dados (`duplicate key / unique constraint`)
- **Quando** o erro 23505 é retornado pelo Supabase
- **Então** não é exibido o alert feio do navegador, e sim um modal elegante em português informando que o cliente já está cadastrado com o botão direto 'Ir para o Cliente' para iniciar o pedido imediatamente

## Fora de escopo

- Alteração da lógica de autenticação do cliente.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-002 | O fluxo de redirecionamento ou abertura do cardápio do cliente com token/dados é preservado integralmente | confirmada | Confirmado com a implementação atual de handleOpenCustomerApp |

## Perguntas em aberto

Nenhuma.
