# Espetinho Vitória — Design System

Referência visual completa para o app mobile e painel admin.

---

## Paleta de Cores (Extraída da Logo)

### Cores Primárias
```css
:root {
  /* Vermelho principal (texto "Vitória" na logo) */
  --cor-primaria: #C41E2E;
  --cor-primaria-hover: #A31825;
  --cor-primaria-light: #E8353F;

  /* Gradiente vermelho da logo */
  --gradiente-primario: linear-gradient(180deg, #E8353F 0%, #8B1A2B 100%);

  /* Púrpura/Magenta (fundo da logo) */
  --cor-secundaria: #7B2D6E;
  --cor-secundaria-hover: #5E2254;
  --cor-secundaria-light: #9B3D8E;

  /* Laranja (chama da logo) */
  --cor-acento: #F5741E;
  --cor-acento-hover: #D96218;
  --cor-acento-light: #FF8C3A;
}
```

### Cores de Fundo (Base Branca)
```css
:root {
  --fundo-principal: #FFFFFF;
  --fundo-cards: #FFFFFF;
  --fundo-secao: #F5F5F7;         /* Cinza ultra claro pra seções */
  --fundo-input: #F0F0F2;
  --fundo-overlay: rgba(0, 0, 0, 0.5);
}
```

### Cores de Texto
```css
:root {
  --texto-principal: #1A1A1A;
  --texto-secundario: #6B7280;
  --texto-terciario: #9CA3AF;
  --texto-branco: #FFFFFF;
  --texto-preco: #C41E2E;         /* Preço em vermelho */
}
```

### Cores de Status (Admin)
```css
:root {
  --status-pendente: #F59E0B;     /* Amarelo */
  --status-confirmado: #3B82F6;   /* Azul */
  --status-preparando: #8B5CF6;   /* Roxo */
  --status-pronto: #10B981;       /* Verde */
  --status-saiu: #F97316;         /* Laranja */
  --status-entregue: #22C55E;     /* Verde forte */
  --status-cancelado: #EF4444;    /* Vermelho */
  --status-esgotado: #6B7280;     /* Cinza */
}
```

---

## Tipografia

```css
/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap');

:root {
  --fonte-corpo: 'Inter', -apple-system, sans-serif;
  --fonte-destaque: 'Poppins', sans-serif;
}
```

| Elemento | Fonte | Peso | Tamanho | Cor |
|----------|-------|------|---------|-----|
| H1 (título da página) | Poppins | 800 | 28px | --texto-principal |
| H2 (seção) | Poppins | 700 | 22px | --texto-principal |
| H3 (subtítulo) | Poppins | 600 | 18px | --texto-principal |
| Corpo | Inter | 400 | 15px | --texto-principal |
| Corpo destaque | Inter | 600 | 15px | --texto-principal |
| Label | Inter | 500 | 13px | --texto-secundario |
| Preço | Poppins | 700 | 18px | --texto-preco |
| Preço grande | Poppins | 800 | 24px | --texto-preco |
| Caption | Inter | 400 | 12px | --texto-terciario |
| Botão | Inter | 600 | 15px | --texto-branco |

---

## Espaçamento

```css
:root {
  --espaco-xs: 4px;
  --espaco-sm: 8px;
  --espaco-md: 12px;
  --espaco-lg: 16px;
  --espaco-xl: 24px;
  --espaco-2xl: 32px;
  --espaco-3xl: 48px;

  --padding-pagina: 16px;         /* Padding lateral das páginas */
  --padding-card: 12px;
  --gap-grid: 12px;               /* Gap entre cards no grid */
}
```

---

## Bordas e Sombras

```css
:root {
  --raio-sm: 8px;
  --raio-md: 12px;
  --raio-lg: 16px;
  --raio-xl: 20px;
  --raio-full: 9999px;            /* Pill / circles */

  --sombra-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --sombra-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --sombra-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --sombra-card: 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

---

## Componentes

### Botão Primário
```css
.btn-primario {
  background: var(--gradiente-primario);
  color: var(--texto-branco);
  font-family: var(--fonte-corpo);
  font-weight: 600;
  font-size: 15px;
  padding: 14px 24px;
  border: none;
  border-radius: var(--raio-full);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(196, 30, 46, 0.3);
}
.btn-primario:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(196, 30, 46, 0.4);
}
```

### Card de Produto
```css
.card-produto {
  background: var(--fundo-cards);
  border-radius: var(--raio-lg);
  box-shadow: var(--sombra-card);
  overflow: hidden;
  transition: transform 0.2s ease;
}
.card-produto:active {
  transform: scale(0.97);
}
.card-produto__imagem {
  width: 100%;
  height: 140px;
  object-fit: cover;
}
.card-produto__info {
  padding: var(--padding-card);
}
.card-produto__nome {
  font-family: var(--fonte-corpo);
  font-weight: 600;
  font-size: 14px;
  color: var(--texto-principal);
}
.card-produto__preco {
  font-family: var(--fonte-destaque);
  font-weight: 700;
  font-size: 16px;
  color: var(--texto-preco);
}
```

### Aba de Categoria (Category Tabs)
```css
.aba-categoria {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--raio-full);
  font-family: var(--fonte-corpo);
  font-weight: 500;
  font-size: 14px;
  border: 1.5px solid #E5E7EB;
  background: var(--fundo-cards);
  color: var(--texto-secundario);
  transition: all 0.2s ease;
}
.aba-categoria--ativa {
  background: var(--cor-primaria);
  color: var(--texto-branco);
  border-color: var(--cor-primaria);
}
```

### Badge Esgotado
```css
.badge-esgotado {
  background: var(--status-esgotado);
  color: var(--texto-branco);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: var(--raio-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### Bottom Navigation (App Cliente)
```css
.nav-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--fundo-cards);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
}
.nav-bottom__item--ativo {
  color: var(--cor-primaria);
}
.nav-bottom__indicador {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--gradiente-primario);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-top: -20px;
  box-shadow: 0 4px 12px rgba(196, 30, 46, 0.3);
}
```

---

## Layout do App Cliente

### Estrutura das Telas

```
┌─────────────────────────────┐
│  Header (logo + sino)       │  Fundo: branco
├─────────────────────────────┤
│  Busca                      │  Input: cinza claro
├─────────────────────────────┤
│  Categorias (scroll horiz)  │  Pills: branco / vermelho ativo
├─────────────────────────────┤
│                             │
│  Grid de Produtos (2 cols)  │  Cards: brancos com sombra
│  ┌─────┐  ┌─────┐          │  Foto + nome + preço + botão +
│  │ 📷  │  │ 📷  │          │
│  │nome │  │nome │          │
│  │R$XX │  │R$XX │          │
│  └─────┘  └─────┘          │
│                             │
├─────────────────────────────┤
│  Nav Bottom (4 itens)       │  Ícones: cinza / vermelho ativo
│  🏠  🛒  📋  👤            │  Carrinho com badge de qtd
└─────────────────────────────┘
```

### Grid de Produtos
```css
.grid-produtos {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--gap-grid);
  padding: 0 var(--padding-pagina);
}
```

### Tela de Detalhe do Produto
```
┌─────────────────────────────┐
│         Foto Grande          │  Fundo: gradiente vermelho
│         (hero image)         │
│    ← Voltar                  │
├─────────────────────────────┤
│  Nome do Produto             │
│  Categoria                   │
│  R$ XX,XX (vermelho)         │
├─────────────────────────────┤
│  Descrição                   │
├─────────────────────────────┤
│  Variações (se açaí)         │  Pills selecionáveis
│  300ml | 500ml | 700ml       │
├─────────────────────────────┤
│  [-] Quantidade [+]          │
│                              │
│  [=== Adicionar R$XX ====]   │  Botão gradiente vermelho
└─────────────────────────────┘
```

### Carrinho com Upsell
```
┌─────────────────────────────┐
│  Seu Carrinho (X itens)      │
├─────────────────────────────┤
│  Item 1        [-] 2 [+] R$ │
│  Item 2        [-] 1 [+] R$ │
├─────────────────────────────┤
│  🔥 "Que tal uma bebida?"   │  Fundo: --fundo-secao
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐   │  Scroll horizontal
│  │🥤 │ │🧃 │ │🥤 │ │🧃 │   │  Cards pequenos
│  │R$X│ │R$X│ │R$X│ │R$X│   │  Botão + em 1 clique
│  └───┘ └───┘ └───┘ └───┘   │
├─────────────────────────────┤
│  Subtotal          R$ XX,XX  │
│  [=== Finalizar Pedido ===]  │
└─────────────────────────────┘
```

---

## Layout do Painel Admin

### Cores Específicas do Admin
```css
:root {
  --admin-sidebar: #1A1A2E;      /* Sidebar escura */
  --admin-fundo: #F5F5F7;        /* Fundo principal claro */
  --admin-card: #FFFFFF;
}
```

### Cards de Métricas
```css
.card-metrica {
  background: white;
  border-radius: var(--raio-lg);
  padding: 20px;
  box-shadow: var(--sombra-sm);
}
.card-metrica__valor {
  font-family: var(--fonte-destaque);
  font-weight: 800;
  font-size: 28px;
  color: var(--texto-principal);
}
.card-metrica__label {
  font-size: 13px;
  color: var(--texto-secundario);
}
.card-metrica--destaque {
  background: var(--gradiente-primario);
  color: white;
}
```

---

## Animações e Transições

```css
:root {
  --transicao-rapida: 150ms ease;
  --transicao-normal: 250ms ease;
  --transicao-suave: 350ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Micro-animação: card pressionado */
@keyframes press {
  0% { transform: scale(1); }
  50% { transform: scale(0.96); }
  100% { transform: scale(1); }
}

/* Micro-animação: item adicionado ao carrinho */
@keyframes addToCart {
  0% { transform: scale(1); }
  30% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* Slide up para modais */
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Fade in para páginas */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## Ícones

Usar [Lucide Icons](https://lucide.dev/) (leves, consistentes, open source).

| Função | Ícone |
|--------|-------|
| Home | `Home` |
| Carrinho | `ShoppingCart` |
| Pedidos | `ClipboardList` |
| Perfil | `User` |
| Buscar | `Search` |
| Voltar | `ArrowLeft` |
| Adicionar | `Plus` |
| Remover | `Minus` |
| Esgotado | `XCircle` |
| Fogo/Destaque | `Flame` |
| Entrega | `Truck` |
| Retirada | `Store` |
| WhatsApp | custom SVG |

---

## Responsividade

```css
/* Mobile (padrão) */
@media (min-width: 0px) {
  .grid-produtos { grid-template-columns: repeat(2, 1fr); }
}

/* Tablet */
@media (min-width: 768px) {
  .grid-produtos { grid-template-columns: repeat(3, 1fr); }
}

/* Desktop (admin) */
@media (min-width: 1024px) {
  .grid-produtos { grid-template-columns: repeat(4, 1fr); }
}
```
