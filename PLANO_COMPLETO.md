# Espetinho Vitória — Plano Completo do Sistema

Sistema completo de pedidos e gestão para o **Espetinho Vitória**: app mobile para clientes (PWA), painel admin desktop/mobile, e backend Supabase com realtime.

---

## Credenciais Supabase (Projeto Criado ✅)

| Dado | Valor |
|------|-------|
| **Project ID** | `vqehwhdlujoajuqunyzu` |
| **URL** | `https://vqehwhdlujoajuqunyzu.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWh3aGRsdWpvYWp1cXVueXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzUwNjEsImV4cCI6MjA4NjQxMTA2MX0.UQK7jxuiaiHktTshedz9dbKFpD-aDpIUyQJw6xs7nNU` |
| **Região** | `sa-east-1` (São Paulo) |

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (React + Vite)            │
│                                                      │
│   ┌──────────────────┐    ┌───────────────────────┐  │
│   │   App Cliente     │    │   Painel Admin        │  │
│   │   (Mobile PWA)    │    │   (Desktop/Mobile)    │  │
│   │                   │    │                       │  │
│   │ • Cardápio        │    │ • Login               │  │
│   │ • Carrinho+Upsell │    │ • Dashboard           │  │
│   │ • Checkout        │    │ • Pedidos Realtime     │  │
│   │ • Tracking        │    │ • Estoque Diário       │  │
│   └──────────────────┘    │ • Relatórios           │  │
│                           │ • Gestão Cardápio       │  │
│                           │ • Motoboys              │  │
│                           └───────────────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │ API
┌────────────────────▼────────────────────────────────┐
│                 SUPABASE (Backend)                    │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐  │
│  │PostgreSQL│ │   Auth   │ │Realtime│ │ Storage  │  │
│  │  (Banco) │ │  (Login) │ │ (Live) │ │ (Fotos)  │  │
│  └──────────┘ └──────────┘ └────────┘ └──────────┘  │
└─────────────────────────────────────────────────────┘
```

- **Frontend:** React (Vite) como PWA, responsivo mobile-first
- **Backend:** Supabase (Auth, Database, Realtime, Storage)
- **Deploy:** Vercel (frontend) + Supabase (backend)

---

## Banco de Dados Completo (10 Tabelas) — Tudo em PT-BR ✅

### 1. `admin_users` — Usuários administrativos
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  cargo TEXT CHECK (cargo IN ('dono', 'gerente')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. `categorias` — Categorias do cardápio
```sql
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  icone TEXT,
  ordem_exibicao INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE
);
```

### 3. `produtos` — Produtos
```sql
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  imagem_url TEXT,
  disponivel BOOLEAN DEFAULT TRUE,
  item_upsell BOOLEAN DEFAULT FALSE,
  tem_estoque_diario BOOLEAN DEFAULT FALSE,
  ordem_exibicao INT DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. `variacoes_produto` — Variações (tamanhos de açaí)
```sql
CREATE TABLE variacoes_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  ordem_exibicao INT DEFAULT 0
);
```

### 5. `estoque_diario` — Controle de estoque diário
```sql
CREATE TABLE estoque_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produtos(id),
  data DATE DEFAULT CURRENT_DATE,
  qtd_inicial INT NOT NULL,
  qtd_atual INT NOT NULL,
  esgotado BOOLEAN DEFAULT FALSE,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produto_id, data)
);
```

### 6. `clientes` — Clientes (com código único pra URL do WhatsApp)
```sql
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE DEFAULT gerar_codigo_cliente(), -- 8 chars aleatórios
  nome TEXT,
  telefone TEXT,
  dados JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
-- Exemplo de código gerado: "aB3xK9mT"
-- URL: seuapp.com/?c=aB3xK9mT
```

### 7. `pedidos` — Pedidos
```sql
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido SERIAL,
  cliente_id UUID REFERENCES clientes(id),
  nome_cliente TEXT NOT NULL,
  telefone_cliente TEXT NOT NULL,
  tipo_pedido TEXT CHECK (tipo_pedido IN ('entrega', 'retirada')),
  status TEXT DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'confirmado', 'preparando',
    'pronto', 'saiu_entrega', 'entregue', 'cancelado'
  )),
  subtotal DECIMAL(10,2) NOT NULL,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) NOT NULL,
  valor_upsell DECIMAL(10,2) DEFAULT 0,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao_entrega')),
  troco_para DECIMAL(10,2),
  endereco JSONB,
  entregador_id UUID REFERENCES entregadores(id),
  observacoes TEXT,
  tempo_estimado INT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  confirmado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ
);
```

### 8. `itens_pedido` — Itens de cada pedido
```sql
CREATE TABLE itens_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  variacao_id UUID REFERENCES variacoes_produto(id),
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  eh_upsell BOOLEAN DEFAULT FALSE
);
```

### 9. `entregadores` — Motoboys
```sql
CREATE TABLE entregadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

### 10. `configuracoes_loja` — Configurações da loja
```sql
CREATE TABLE configuracoes_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_loja TEXT DEFAULT 'Espetinho Vitória',
  endereco TEXT,
  telefone TEXT,
  horario_abertura TIME,
  horario_fechamento TIME,
  esta_aberta BOOLEAN DEFAULT TRUE,
  taxa_entrega DECIMAL(10,2) DEFAULT 5.00,
  pedido_minimo DECIMAL(10,2) DEFAULT 0,
  chave_pix TEXT,
  logo_url TEXT
);
```

### Funções do Banco
- `gerar_codigo_cliente()` — Gera código de 8 chars aleatórios (único)
- `dar_baixa_estoque(produto_id, quantidade)` — Baixa automática no estoque
- `resumo_vendas(data_inicio, data_fim)` — Resumo de vendas por período
- `produtos_mais_vendidos(data_inicio, data_fim)` — Ranking de produtos
- `entregas_por_motoboy(data_inicio, data_fim)` — Entregas por motoboy

### Realtime Habilitado
- `pedidos` — Atualização em tempo real no admin
- `estoque_diario` — Atualização em tempo real

### Storage
- Bucket `imagens-produtos` — Fotos dos produtos (JPEG, PNG, WebP, max 5MB)

---

## Segurança — RLS (Row Level Security) ✅

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| categorias | Público (ativas) | Admin | Admin | Admin |
| produtos | Público (disponíveis) | Admin | Admin | Admin |
| variacoes_produto | Público | Admin | Admin | Admin |
| estoque_diario | Público (leitura) | Admin | Admin | — |
| clientes | Público | Público | — | — |
| pedidos | Público (tracking) | Público | Admin | — |
| itens_pedido | Público | Público | — | — |
| entregadores | Admin | Admin | Admin | Admin |
| configuracoes_loja | Público (leitura) | Admin | Admin | — |
| admin_users | Admin | Admin | Admin | Admin |

---

## App Cliente (Mobile PWA) — Funcionalidades

### Fluxo Principal do Cliente
```
Splash Screen → Cardápio → Produto → Carrinho + Upsell → Checkout → Tracking
```

### 1. Tela Inicial / Cardápio
- Categorias em **abas horizontais** (Espetos | Açaí | Bebidas | Caldos)
- Produtos em **cards com foto, nome e preço**
- Badge "ESGOTADO" quando acaba o estoque
- Indicador se a loja está aberta/fechada

### 2. Detalhes do Produto
- Foto grande
- Nome, descrição, preço
- Seletor de variação (tamanhos de açaí)
- Seletor de quantidade
- Botão "Adicionar ao Carrinho"

### 3. Carrinho + Sistema de Upsell
- Lista de itens adicionados
- **Carrossel horizontal de upsell** com texto *"Que tal uma bebida gelada?"*
- Itens de upsell adicionados com **1 clique**
- Antes de finalizar, outro prompt: *"Não esquece o açaí de sobremesa!"*
- Todos itens de upsell são rastreados (`is_upsell = true`)

### 4. Checkout
- **Dados do cliente:** Nome, telefone (salva no localStorage)
- **Tipo de pedido:** Entrega ou Retirada
- **Endereço** (se entrega): Rua, número, bairro, complemento, referência
- **Forma de pagamento:** PIX, Dinheiro (campo troco), Cartão na entrega
- **Observações**
- **Resumo do pedido** com total

### 5. Acompanhamento em Tempo Real
- Timeline visual com status:
  ```
  ✅ Recebido → ✅ Confirmado → 🔄 Preparando → ⏳ Pronto → 🏍️ Saiu → 📦 Entregue
  ```
- Atualização via **Supabase Realtime** (sem refresh)

### 6. Loja Fechada
- Se fora do horário → mostra tela de "Estamos fechados"
- Mostra horário de funcionamento

---

## Painel Admin — Funcionalidades

### 1. Login Admin
- Email + senha via Supabase Auth
- Apenas usuários na tabela `admin_users`
- Sessão persistente

### 2. Dashboard Principal
- **Vendas do dia** (R$ total + quantidade de pedidos)
- **Vendas por upsell** do dia (R$ + % do total)
- **Pedidos pendentes** (contador em destaque com cor)
- **Entregas realizadas** (quantas o motoboy fez hoje)
- **Ticket médio**

### 3. Filtros Inteligentes de Relatórios
- Por **data**: hoje, ontem, semana, mês, intervalo customizado
- Por **tipo**: delivery / retirada
- Por **forma de pagamento**: pix, dinheiro, cartão
- Por **categoria de produto**
- **Métricas detalhadas:**
  - Total vendido (R$)
  - Quantidade de pedidos
  - Ticket médio
  - **Vendas originadas por upsell** (R$ e % do total) ← filtro inteligente
  - Entregas por motoboy
  - Produtos mais vendidos (ranking)

### 4. Gestão de Pedidos (Tempo Real)
- Lista de pedidos com **cores por status** (verde, amarelo, vermelho)
- Botões rápidos de avançar status:
  ```
  Confirmar → Preparando → Pronto → Enviado → Entregue
  ```
- Atribuir motoboy ao pedido
- Cancelar pedido (com motivo)
- **🔔 Som/alerta** ao receber novo pedido
- Atualização via **Supabase Realtime**

### 5. Controle de Estoque Diário
- Lista de produtos com estoque diário (espetos, açaí, caldos)
- Admin define a **quantidade do dia** (ex: 200 espetos, 30 açaís)
- Conforme vendem → **quantidade atualiza automaticamente**
- Botão **"ESGOTADO"** em 1 clique (override manual)
- ⚠️ Alerta quando estoque baixo (< 10 unidades)
- Histórico de estoque por dia

### 6. Gestão de Cardápio
- Adicionar / editar / excluir produtos
- Upload de fotos (Supabase Storage)
- Ativar / desativar produtos
- Reordenar categorias e produtos (drag & drop)
- Definir quais itens são de upsell

### 7. Gestão de Motoboys
- Cadastrar motoboys (nome, telefone)
- Ver quantidade de entregas por motoboy (com filtro de data)
- Ativar / desativar motoboy

### 8. Configurações da Loja
- Nome, endereço, telefone
- Horário de funcionamento
- Taxa de entrega
- Pedido mínimo
- Chave PIX
- Logo
- Botão manual **Abrir/Fechar** loja

---

## Estrutura de Pastas

```
espetinho-vitoria/
├── PLANO_COMPLETO.md              ← ESTE ARQUIVO
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service Worker
│   └── icons/                     # Ícones do PWA
├── src/
│   ├── main.jsx                   # Entry point
│   ├── App.jsx                    # Router principal
│   ├── index.css                  # Design system global
│   │
│   ├── lib/
│   │   ├── supabase.js            # Cliente Supabase
│   │   └── utils.js               # Funções utilitárias
│   │
│   ├── hooks/
│   │   ├── useCart.js              # Estado do carrinho
│   │   ├── useOrders.js           # Pedidos (realtime)
│   │   ├── useInventory.js        # Estoque
│   │   ├── useProducts.js         # Produtos e categorias
│   │   └── useAuth.js             # Autenticação admin
│   │
│   ├── components/
│   │   ├── customer/
│   │   │   ├── CategoryTabs.jsx       # Abas de categorias
│   │   │   ├── ProductCard.jsx        # Card de produto
│   │   │   ├── ProductDetail.jsx      # Detalhe do produto
│   │   │   ├── Cart.jsx               # Carrinho
│   │   │   ├── UpsellCarousel.jsx     # Carrossel de upsell
│   │   │   ├── Checkout.jsx           # Finalizar pedido
│   │   │   ├── OrderTracking.jsx      # Acompanhamento
│   │   │   └── StoreClosed.jsx        # Loja fechada
│   │   │
│   │   ├── admin/
│   │   │   ├── AdminLogin.jsx         # Login admin
│   │   │   ├── Dashboard.jsx          # Dashboard métricas
│   │   │   ├── OrderManager.jsx       # Gestão de pedidos
│   │   │   ├── InventoryManager.jsx   # Estoque diário
│   │   │   ├── MenuManager.jsx        # Gestão cardápio
│   │   │   ├── ReportsPanel.jsx       # Relatórios
│   │   │   ├── DriverManager.jsx      # Motoboys
│   │   │   └── StoreSettings.jsx      # Configurações
│   │   │
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Modal.jsx
│   │       ├── Badge.jsx
│   │       └── Loading.jsx
│   │
│   └── pages/
│       ├── CustomerApp.jsx        # Layout do app cliente
│       └── AdminPanel.jsx         # Layout do admin
│
├── index.html
├── vite.config.js
└── package.json
```

---

## Pendências (Definir com o Dono)

1. **Cardápio inicial** — Nomes e preços de espetos, tamanhos de açaí, sabores de caldos, lista de bebidas
2. **Taxa de entrega** — Valor fixo ou por bairro?
3. **Formas de pagamento** — PIX (chave?), cartão na entrega, dinheiro?
4. **Horário de funcionamento** — Abre e fecha que horas?
5. **Notificações** — Som no painel, push, WhatsApp?
6. **Cores e identidade visual** — Cores do app, logo
7. **Endereço do estabelecimento**
8. **Motoboys** — Quantos? Login separado?
