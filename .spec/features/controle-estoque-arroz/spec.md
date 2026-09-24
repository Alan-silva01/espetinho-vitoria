# Spec: Controle de estoque arroz

> feature: controle-estoque-arroz
> status: rascunho

## Contexto

Quando um cliente seleciona um espetinho "Completo", ele precisa escolher um
tipo de arroz (Arroz Baião, Arroz Branco, etc.). Cada arroz é um produto no
catálogo com `controlar_estoque = true` e `quantidade_disponivel` finito.

**Bug reportado (2026-09-23):** com apenas 1 Arroz Baião em estoque, um cliente
conseguiu adicionar 4 espetinhos com Arroz Baião ao carrinho — sem nenhum
bloqueio. A validação de estoque de acompanhamentos não está funcionando
corretamente no fluxo de adição ao carrinho.

## Histórias

### US-001 — Estoque de arroz é validado ao adicionar ao carrinho

Como cliente, quero que o app me avise quando o arroz que escolhi está
acabando, para que eu não finalize um pedido que a cozinha não pode atender.

#### AC-001 — Arroz com estoque suficiente permite adicionar

- **Dado** o produto "Arroz Baião" com `controlar_estoque: true` e `quantidade_disponivel: 1`
- **Quando** o cliente tenta adicionar 1 espetinho com Arroz Baião e o carrinho está vazio
- **Então** a validação retorna `valid: true`

#### AC-002 — Arroz com estoque insuficiente bloqueia e mostra mensagem

- **Dado** o produto "Arroz Baião" com `controlar_estoque: true` e `quantidade_disponivel: 1`
- **Quando** o cliente tenta adicionar 2 espetinhos com Arroz Baião e o carrinho está vazio
- **Então** a validação retorna `valid: false` com mensagem informando o estoque disponível

#### AC-003 — Estoque considera itens já no carrinho

- **Dado** o produto "Arroz Baião" com `controlar_estoque: true` e `quantidade_disponivel: 1`
- **E** o carrinho já contém 1 espetinho com Arroz Baião
- **Quando** o cliente tenta adicionar mais 1 espetinho com Arroz Baião
- **Então** a validação retorna `valid: false` com `availableQty: 0`

#### AC-004 — Arroz sem controle de estoque não é bloqueado

- **Dado** o produto "Arroz Branco" com `controlar_estoque: false`
- **Quando** o cliente tenta adicionar qualquer quantidade de espetinhos com Arroz Branco
- **Então** a validação retorna `valid: true` (sem restrição)

#### AC-005 — Arroz esgotado bloqueia completamente

- **Dado** o produto "Arroz Baião" com `controlar_estoque: true` e `quantidade_disponivel: 0`
- **Quando** o cliente tenta adicionar 1 espetinho com Arroz Baião
- **Então** a validação retorna `valid: false` com `availableQty: 0`

#### AC-006 — Estoque alto permite múltiplos pedidos

- **Dado** o produto "Arroz Baião" com `controlar_estoque: true` e `quantidade_disponivel: 5`
- **Quando** o cliente tenta adicionar 3 espetinhos com Arroz Baião e o carrinho está vazio
- **Então** a validação retorna `valid: true`

#### AC-007 — Carrinho parcial + novo pedido excede estoque

- **Dado** o produto "Arroz Baião" com `controlar_estoque: true` e `quantidade_disponivel: 5`
- **E** o carrinho já contém 3 espetinhos com Arroz Baião
- **Quando** o cliente tenta adicionar mais 3 espetinhos com Arroz Baião
- **Então** a validação retorna `valid: false` com `availableQty: 2`

#### AC-008 — Validação em lote para todas as opções selecionadas

- **Dado** opções selecionadas com "Arroz Baião" (estoque=1) e "Farofa" (estoque=10)
- **Quando** a validação em lote é executada
- **Então** retorna `valid: false` para o primeiro item sem estoque (Arroz Baião)

## Fora de escopo

- Alterações no componente ProductPage.jsx (em produção)
- Mudanças no banco de dados ou RPC functions
- UI do modal de aviso (já existe e funciona)

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | O arroz é registrado como produto no catálogo com controlar_estoque=true | confirmada | Verificado no código: getOptionStock busca por nome no catálogo |
| ASM-002 | A quantidade_disponivel do produto reflete o estoque real | confirmada | Atualizado via useInventory + triggers do DB |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | O nome do arroz na personalizacao bate exatamente com o nome no catálogo? | aberta | Se não bater, getOptionStock retorna null e o check é pulado — possível causa raiz do bug |
