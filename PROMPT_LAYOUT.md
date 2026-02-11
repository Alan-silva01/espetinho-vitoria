# Prompt para Criar Layout — Espetinho Vitória

Copie o prompt abaixo e envie junto com as imagens de referência.

---

## PROMPT:

```
Crie um design completo de UI/UX para um app mobile de delivery de comida chamado "Espetinho Vitória". O app vende espetos, açaí (vários tamanhos), caldos e bebidas. Envio a logo e imagens de referência de layout.

### ESTILO VISUAL
- Fundo base: BRANCO (#FFFFFF) com seções em cinza claro (#F5F5F7)
- Cor primária: VERMELHO (#C41E2E) — botões, preços, abas ativas, destaques
- Cor secundária: PÚRPURA (#7B2D6E) — detalhes e gradientes
- Cor acento: LARANJA (#F5741E) — ícone de fogo, promoções, badges
- Gradiente principal: de #E8353F para #8B1A2B (usar nos botões principais e headers)
- Estilo: clean, moderno, premium — como nas imagens de referência com cards brancos, sombras suaves, cantos arredondados (16px)
- Tipografia: Inter para corpo, Poppins Bold para títulos e preços

### TELAS NECESSÁRIAS (Mobile 390x844)

**TELA 1 — Home (Cardápio)**
- Header: logo "Espetinho Vitória" à esquerda + ícone de sino à direita
- Barra de busca com fundo cinza claro e ícone de lupa
- Categorias em pills horizontais com scroll (🔥 Espetos | 🍇 Açaí | 🥤 Bebidas | 🍲 Caldos) — aba ativa em vermelho com texto branco
- Grid de produtos em 2 colunas — cards brancos com:
  - Foto do produto (arredondada no topo, 140px de altura)
  - Nome do produto (Inter Semi-Bold 14px)
  - Preço em vermelho (Poppins Bold 16px) "R$ 8,00"
  - Botão + vermelho no canto inferior direito do card
- Bottom navigation bar fixa: 🏠 Home | 🛒 Carrinho (com badge) | 📋 Pedidos | 👤 Perfil
  - Item ativo em vermelho, ícone do carrinho com círculo gradiente vermelho elevado

**TELA 2 — Detalhe do Produto**
- Header com foto grande do produto como hero (fundo com gradiente vermelho)
- Botão de voltar (←) branco sobre a foto
- Abaixo da foto: nome, categoria, preço grande em vermelho
- Descrição do produto
- Se for açaí: seletor de tamanho em pills (300ml | 500ml | 700ml)
- Seletor de quantidade: [-] número [+] com bordas arredondadas
- Botão "Adicionar ao Carrinho — R$ XX,XX" — gradiente vermelho, pill, largura total, com sombra

**TELA 3 — Carrinho com Upsell**
- Título "Seu Carrinho" com quantidade de itens
- Lista de itens:  nome + foto miniatura + seletor de qtd + preço
- SEÇÃO DE UPSELL (fundo cinza claro):
  - Título com ícone de fogo: "🔥 Que tal uma bebida gelada?"
  - Scroll horizontal de cards pequenos de bebidas/complementos
  - Cada card: foto + nome + preço + botão "+" em 1 clique (sem ir pra detalhe)
- Resumo: subtotal + taxa de entrega + total
- Botão "Finalizar Pedido" gradiente vermelho

**TELA 4 — Checkout**
- Tipo de pedido: "Entrega" | "Retirada" em cards selecionáveis
- Se entrega: campos de endereço (rua, número, bairro, complemento, referência)
- Forma de pagamento: PIX | Dinheiro | Cartão na entrega
  - Se dinheiro: campo "Troco pra quanto?"
- Campo observações
- Resumo do pedido
- Botão "Confirmar Pedido"

**TELA 5 — Acompanhamento do Pedido**
- Steps verticais com status visual:
  ✅ Pedido recebido → ⏳ Confirmado → 🍳 Preparando → ✅ Pronto → 🛵 Saiu para entrega → 📦 Entregue
- Info do entregador (se entrega)
- Número do pedido grande
- Tempo estimado

### REGRAS DE DESIGN
- Todos os cards com border-radius: 16px e sombra suave
- Botões principais: border-radius pill (9999px), gradiente vermelho
- Espaçamento consistente: 16px de padding lateral
- Gap entre cards: 12px
- Bottom nav com safe area padding
- Design limpo como as referências — NÃO usar cores escuras de fundo, apenas branco e cinza muito claro
- Preços sempre em vermelho (#C41E2E) e fonte bold
- Fotos dos produtos devem ser grandes e apetitosas
- Use produtos reais: espetos de carne, açaí em copo, refrigerantes, caldo de galinha
```

---

## COMO USAR

1. Copie o texto acima (entre os ```)
2. Cole na IA de design (v0, Midjourney, ChatGPT, etc.)
3. Anexe as mesmas imagens de referência: logo + layouts de exemplo
4. A IA vai gerar o layout baseado nas cores da logo e no estilo das referências
