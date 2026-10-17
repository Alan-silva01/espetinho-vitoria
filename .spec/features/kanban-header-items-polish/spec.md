# Spec: Kanban header items polish

> feature: kanban-header-items-polish
> status: pronta

## Contexto

Polimento e harmonização do header do painel Kanban administrativo (transformando o botão de teste de som em um botão compacto de ícone com Volume2, ajustando filtros e busca) e destacando o nome dos itens em negrito para melhor legibilidade operacional no recibo e no card do Kanban.

## Histórias

### US-013 — Polimento visual do Header do Kanban e destaque em negrito dos itens do pedido

Como operador do painel administrativo,
Quero uma barra de ferramentas no Kanban limpa e harmoniosa com botão de som compacto e itens de pedido com nomes em destaque em negrito,
Para que a visualização seja rápida, profissional e sem poluição visual.

#### AC-058 — Botão de som compacto com ícone Volume2 e tooltip no header do Kanban
- **Dado** que o operador está visualizando o cabeçalho do Kanban em OrdersPage
- **Quando** o cabeçalho é renderizado
- **Então** o botão de testar/ativar som deve ser renderizado de forma compacta (apenas ícone Volume2 com tamanho 15px), com título descritivo de tooltip e sem o texto solto "Ativar Som".

#### AC-059 — Ajuste e harmonização visual do filtro e busca no header
- **Dado** que o operador utiliza a barra de ações do header
- **Quando** os botões e inputs de busca e data são exibidos
- **Então** o gatilho de data e a caixa de busca devem manter altura padronizada, alinhamento consistente e bordas harmoniosas com os demais botões de ação.

#### AC-060 — Nome dos itens de pedidos em negrito no modal de detalhes (recibo)
- **Dado** que o modal de detalhes do pedido (OrderDetailModal) é aberto
- **Quando** a lista de produtos é renderizada
- **Então** o título/nome do item deve ser exibido com destaque em negrito (font-weight 700/800) para leitura imediata da cozinha/atendimento.

#### AC-061 — Nome dos itens de pedidos em negrito no card do Kanban
- **Dado** que os cards de pedidos são renderizados nas colunas do Kanban
- **Quando** os itens do pedido são listados no card
- **Então** tanto a quantidade quanto o nome do produto devem estar destacados em negrito com contraste limpo e legível.

#### AC-062 — Indicador visual de som ativo (verde) e inativo (vermelho) com toggle
- **Dado** que o operador clica no botão de som do cabeçalho
- **Quando** o estado de som é alternado ou carregado
- **Então** o botão deve refletir visualmente se o som está ativo com fundo e borda verde (`.sound-active`), ou vermelho quando inativo (`.sound-inactive`), alternando os ícones Volume2 e VolumeX com tooltips correspondentes.

## Fora de escopo

- Alterações na lógica de WebSocket/Realtime do som de notificação.
- Alterações em regras de negócio de cálculo de comanda ou taxas.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-002 | O ícone Volume2 da biblioteca lucide-react já está disponível no projeto | confirmada | lucide-react já é dependência do projeto |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-002 | Qual ícone e formato deve ser adotado para o som? | respondida | Ícone Volume2 em botão compacto 30x30px padronizado |
