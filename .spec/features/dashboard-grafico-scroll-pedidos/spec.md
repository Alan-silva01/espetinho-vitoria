# Spec: Dashboard grafico expandido e scroll infinito de pedidos

> feature: dashboard-grafico-scroll-pedidos
> status: rascunho

## Contexto

No painel administrativo (/admin/dashboard), a visualização atual divide o espaço horizontal 
em duas colunas: o gráfico de vendas (área) à esquerda e uma lista vertical compacta de "Últimos Pedidos" 
limitada a 4 itens à direita.

O usuário solicitou uma reformulação visual:
1. O gráfico de vendas deve ocupar a largura total expandida (100% da linha).
2. A lista de últimos pedidos ao lado é removida.
3. Logo abaixo do gráfico expandido, deve ser exibido um carrossel / scroll horizontal contínuo e infinito
   apenas com os pedidos do dia atual (sempre o do dia corrente).
4. Cada card do scroll horizontal deve exibir: foto (ou avatar inicial), nome do cliente, status do pedido, 
   valor formatado e o número do pedido SEM o prefixo '#' (ex: '2934' em vez de '#2934').

## Histórias

### US-003 — Gráfico de vendas expandido em largura total

Como administrador do Espetinho Vitória,
Quero visualizar o gráfico de vendas ocupando toda a largura horizontal da linha do dashboard,
Para que eu consiga analisar a evolução das vendas diárias com máxima clareza e escala visual.

#### AC-012 — Gráfico ocupa 100% da largura da seção
- **Dado** o painel de Dashboard renderizado
- **Quando** a seção de gráficos é inspecionada
- **Então** o card do gráfico não divide coluna com os últimos pedidos e se estende por toda a largura disponível.

### US-004 — Pedidos de hoje em scroll horizontal contínuo

Como administrador,
Quero acompanhar todos os pedidos realizados no dia atual logo abaixo do gráfico em um scroll horizontal contínuo e fluído,
Para que eu consiga monitorar rapidamente a fila do dia com identificação visual clara de cada pedido.

#### AC-013 — Filtragem restrita aos pedidos do dia corrente
- **Dado** uma lista mista de pedidos de múltiplos dias
- **Quando** a função `filterTodayOrders` é executada com a data de hoje (America/Sao_Paulo)
- **Então** apenas os pedidos criados na data do dia corrente são retornados, ordenados do mais recente para o mais antigo.

#### AC-014 — Exibição de foto ou avatar, nome do cliente, status e valor
- **Dado** um pedido do dia corrente com cliente, status, valor_total e foto/avatar
- **Quando** o card horizontal de pedido é montado
- **Então** apresenta a imagem de avatar do cliente (ou inicial fallback), nome legível, tag de status e valor formatado em reais.

#### AC-015 — Número do pedido sem o prefixo '#'
- **Dado** um número de pedido numérico ou string com '#' (ex: '#2934', '##2934', 2934)
- **Quando** a função `formatOrderNumberWithoutHash` formata o valor
- **Então** retorna a string limpa sem nenhum caractere '#' inicial (ex: '2934').

#### AC-016 — Carrossel horizontal com suporte a rolagem suave ou scroll infinito
- **Dado** a seção de pedidos do dia abaixo do gráfico
- **Quando** há pedidos do dia
- **Então** eles são renderizados em um trilho horizontal (`overflow-x: auto` com touch scroll ou looping infinito) garantindo visualização compacta e dinâmica.

## Fora de escopo

- Alteração da lógica de cálculo dos cards de KPI superiores (vendas hoje, ticket médio, upsell).
- Modificação das seções "Alertas de Estoque", "Por Categoria" e "Mais Vendidos".
- Modificação de rotas do painel admin.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-003 | Os pedidos do dia referem-se ao fuso horário de São Paulo (America/Sao_Paulo), consistente com o restante do dashboard | confirmada | Implementado em `filterTodayOrders` usando timeZone America/Sao_Paulo |
| ASM-004 | Se não houver pedidos no dia, exibe estado vazio amigável ("Nenhum pedido realizado hoje ainda") | confirmada | Tratamento de lista vazia no componente do dashboard |

## Perguntas em aberto

Nenhuma.
