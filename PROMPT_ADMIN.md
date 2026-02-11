# Prompt para Criar Layout do Painel Admin — Espetinho Vitória

Copie o prompt abaixo e envie junto com as imagens de referência (logo + layouts de app que já usou).

---

## PROMPT:

```
Crie um design completo de UI/UX para o PAINEL ADMINISTRATIVO do "Espetinho Vitória" — um sistema de gestão para restaurante de espetos, açaí, caldos e bebidas. Preciso de DUAS versões: DESKTOP (1440x900) e MOBILE (390x844). Envio a logo para referência de cores.

### ESTILO VISUAL
- Fundo base: cinza claro (#F5F5F7)
- Cards e painéis: BRANCO (#FFFFFF) com sombra suave
- Cor primária: VERMELHO (#C41E2E) — botões, gráficos, destaques
- Cor secundária: PÚRPURA (#7B2D6E) — gráficos secundários
- Cor acento: LARANJA (#F5741E) — alertas, upsell
- Gradiente principal: de #E8353F para #8B1A2B
- Sidebar (desktop): fundo escuro (#1A1A2E) com ícones e texto claro
- Tipografia: Inter para corpo, Poppins Bold para números e títulos
- Estilo: clean, moderno, profissional, dashboard estilo SaaS premium
- Cantos arredondados: 16px nos cards, 12px nos inputs

### CORES DE STATUS DOS PEDIDOS
- 🟡 Pendente: #F59E0B (amarelo)
- 🔵 Confirmado: #3B82F6 (azul)
- 🟣 Preparando: #8B5CF6 (roxo)
- 🟢 Pronto: #10B981 (verde)
- 🟠 Saiu Entrega: #F97316 (laranja)
- ✅ Entregue: #22C55E (verde forte)
- ❌ Cancelado: #EF4444 (vermelho)

---

### TELAS NECESSÁRIAS — VERSÃO DESKTOP (1440x900)

A sidebar fica fixa à esquerda com:
- Logo no topo
- Menu: 📊 Dashboard | 📋 Pedidos | 🍖 Cardápio | 📦 Estoque | 🛵 Motoboys | 📈 Relatórios | ⚙️ Configurações
- Avatar do admin embaixo

**TELA 1 — Dashboard Principal**
Layout em grid de 3 colunas com cards de métricas no topo:

Card 1: "Vendas Hoje" — R$ 2.450,00 (fonte grande, Poppins 800, com seta verde ↑12%) — fundo gradiente vermelho, texto branco
Card 2: "Pedidos Hoje" — 47 pedidos (com breakdown: 32 entregas + 15 retiradas)
Card 3: "Ticket Médio" — R$ 52,12
Card 4: "Upsell Hoje" — R$ 380,00 (com badge laranja "🔥 +15% vs ontem")

Abaixo dos cards, 2 colunas:
- COLUNA ESQUERDA (60%):
  - Gráfico de LINHAS: "Vendas dos Últimos 7 Dias" — linha vermelha para vendas totais, linha laranja pontilhada para vendas de upsell
  - Gráfico de BARRAS: "Vendas por Categoria" — barras coloridas (Espetos=vermelho, Açaí=púrpura, Bebidas=laranja, Caldos=amarelo)
- COLUNA DIREITA (40%):
  - "Últimos Pedidos" — lista com: horário + nome + valor + status (badge colorido) — scroll com os 10 últimos
  - "Produtos Mais Vendidos" — mini ranking com foto + nome + quantidade vendida

Filtro de data no topo direito: "Hoje | 7 dias | 30 dias | Personalizado"

**TELA 2 — Gestão de Pedidos**
- Filtros no topo: status (pills coloridas) + busca por nome/telefone + data
- Kanban horizontal com colunas por status:
  | Pendente (3) | Confirmado (2) | Preparando (4) | Pronto (1) | Saiu Entrega (2) | Entregue (12) |
- Cada card de pedido mostra:
  - #047 (número do pedido)
  - Nome do cliente + telefone
  - Itens resumidos (ex: "2x Espeto Carne, 1x Açaí 500ml")
  - Valor total em vermelho
  - Tipo: badge "🛵 Entrega" ou "🏪 Retirada"
  - Tempo desde o pedido (ex: "há 8 min")
  - Botão de ação: "Confirmar" / "Pronto" / "Saiu" etc. (gradiente vermelho)
- Clicar num card abre um modal lateral com todos os detalhes do pedido

**TELA 3 — Controle de Estoque Diário**
- Cabeçalho: "Estoque do Dia — 11/02/2026" com seletor de data
- Grid de cards por categoria:

  ESPETOS:
  ┌───────────────────────────────────────┐
  │ 🍖 Espeto de Carne                   │
  │ Inicial: 50 → Atual: 23 → Vendidos: 27 │
  │ [████████████░░░░░░░░] 46% restante   │  Barra de progresso verde→amarelo→vermelho
  │ [Marcar Esgotado] ← botão 1 clique    │
  └───────────────────────────────────────┘

  AÇAÍ:
  (mesmo formato, com tamanhos: 300ml, 500ml, 700ml — estoque individual por variação)

  CALDOS:
  (mesmo formato)

- Seção "Cadastrar Estoque do Dia" — formulário rápido com inputs numéricos + botão "Salvar"
- Toggle switches para marcar esgotado em 1 clique (vermelho quando esgotado)

**TELA 4 — Motoboys**
- Lista de motoboys ativos com foto/avatar, nome, telefone, status (disponível/em entrega)
- Card por motoboy:
  - Nome
  - "Entregas Hoje: 8"
  - "Valor Entregue: R$ 620,00"
  - Última entrega: "há 12 min"
- Gráfico de PIZZA: distribuição de entregas por motoboy (% de cada um)

**TELA 5 — Relatórios / Análises**
- Filtro de período no topo: data início → data fim + botão "Filtrar"
- Cards de resumo:
  - Total Vendido | Total Pedidos | Ticket Médio | Total Upsell | % Conversão Upsell
- Gráficos:
  1. Gráfico de LINHAS: evolução de vendas no período (diário) — com linha de upsell separada em laranja
  2. Gráfico de BARRAS empilhadas: vendas por categoria por dia
  3. Gráfico de ROSCA/DONUT: "Receita por Forma de Pagamento" (PIX=azul, Dinheiro=verde, Cartão=laranja)
  4. "Top 10 Produtos Mais Vendidos" — barras horizontais com foto miniatura
  5. Card especial laranja: "Impacto do Upsell" — R$ total vendido por upsell / % do faturamento total / crescimento vs período anterior (seta verde)
- Tabela com pedidos detalhados: #, data, cliente, itens, valor, upsell, pagamento, status — com paginação

**TELA 6 — Cardápio (CRUD)**
- Grid de produtos com foto + nome + preço + categoria + toggle disponível/indisponível
- Botão "+ Novo Produto" (gradiente vermelho)
- Modal de edição: upload foto, nome, descrição, preço, categoria (dropdown), variações (para açaí), toggle upsell, toggle estoque diário

---

### TELAS NECESSÁRIAS — VERSÃO MOBILE (390x844)

No mobile, a sidebar vira um menu hamburger (☰) que abre um drawer lateral.
Bottom tab navigation: 📊 | 📋 | 📦 | 🛵 | ⚙️

**TELA M1 — Dashboard Mobile**
- Cards de métricas empilhados (1 coluna, scroll vertical):
  - Vendas Hoje (card gradiente vermelho)
  - Pedidos | Ticket Médio | Upsell (cards brancos)
- Gráfico de linhas simplificado (7 dias)
- Lista "Últimos Pedidos" compacta

**TELA M2 — Pedidos Mobile**
- Lista vertical de cards de pedido (não kanban)
- Filtro por status com pills coloridas no topo (scroll horizontal)
- Cada card: número + nome + valor + tipo + status + tempo
- Swipe para ação rápida: ex. Swipe direita = "Confirmar"
- Tap abre detalhe full screen

**TELA M3 — Estoque Mobile**
- Cards empilhados por produto com barra de progresso
- Toggle de esgotado bem grande (fácil de clicar no celular)
- Botão flutuante "+" para cadastrar estoque do dia

**TELA M4 — Motoboys Mobile**
- Lista de motoboys com avatar + nome + entregas do dia + valor
- Tap expande com detalhes

### REGRAS DE DESIGN
- Desktop: sidebar escura (#1A1A2E) + conteúdo em fundo claro (#F5F5F7)
- Mobile: fundo branco, sem sidebar, menu hamburger + bottom tabs
- Todos os números financeiros em Poppins Bold, cor vermelha para valores
- Gráficos com cores da marca: vermelho, púrpura, laranja, verde
- Cards com border-radius 16px e sombras suaves
- Botões primários: gradiente vermelho, pill shape
- Badges de status com as cores definidas acima
- Dados devem parecer realistas (valores em R$, nomes brasileiros)
- Estoque usa barras de progresso que mudam de cor: verde (>50%) → amarelo (20-50%) → vermelho (<20%)
```
