# Spec: Controle de estoque arroz

> feature: controle-estoque-arroz
> status: rascunho

## Contexto

Quando um cliente seleciona um espetinho "Completo", ele precisa escolher um
tipo de arroz (Baião de Dois, Arroz com Cenoura, etc.). 
No banco de dados (Supabase), os arrozes não são produtos na tabela `produtos`, 
mas sim opções registradas dentro de `opcoes_personalizacao` (grupo "Tipo de Arroz"), 
onde o estoque é controlado pelo campo `quantidade` de cada opção (ex: `{ nome: "Arroz com Cenoura", quantidade: 1 }`).

**Bug reportado:** Com apenas 1 "Arroz com Cenoura" em estoque, o cliente consegue selecionar 
quantidade 2 ou 4 espetinhos com esse arroz e adicionar ao carrinho sem nenhum bloqueio.

## Histórias

### US-001 — Estoque de arroz é validado ao adicionar ao carrinho e ao alterar quantidade

Como cliente, quero que o app me avise quando o arroz que escolhi não possui quantidade
suficiente para o número de espetinhos selecionados, para que eu não finalize um pedido que a cozinha não pode atender.

#### AC-001 — Arroz com estoque suficiente permite adicionar
- **Dado** a opção "Arroz Baião" com estoque 1 (seja em `opcoes_personalizacao` ou catálogo)
- **Quando** o cliente tenta adicionar 1 espetinho com Arroz Baião e o carrinho está vazio
- **Então** a validação retorna `valid: true`

#### AC-002 — Arroz com estoque insuficiente bloqueia e mostra mensagem
- **Dado** a opção "Arroz com Cenoura" com estoque 1
- **Quando** o cliente tenta adicionar 2 espetinhos com Arroz com Cenoura e o carrinho está vazio
- **Então** a validação retorna `valid: false` com mensagem informando o estoque disponível

#### AC-003 — Estoque considera itens já no carrinho
- **Dado** a opção "Arroz Baião" com estoque 1
- **E** o carrinho já contém 1 espetinho com Arroz Baião
- **Quando** o cliente tenta adicionar mais 1 espetinho com Arroz Baião
- **Então** a validação retorna `valid: false` com `availableQty: 0`

#### AC-004 — Opção sem controle de estoque não é bloqueada
- **Dado** uma opção com quantidade não definida ou sem limite
- **Quando** o cliente tenta adicionar qualquer quantidade
- **Então** a validação retorna `valid: true` (sem restrição)

#### AC-005 — Arroz esgotado bloqueia completamente
- **Dado** a opção "Arroz com Cuxá" com `quantidade: 0`
- **Quando** o cliente tenta adicionar 1 espetinho com essa opção
- **Então** a validação retorna `valid: false` com `availableQty: 0`

#### AC-006 — Estoque alto permite múltiplos pedidos
- **Dado** a opção "Baião de Dois" com estoque 21
- **Quando** o cliente tenta adicionar 3 espetinhos com Baião de Dois
- **Então** a validação retorna `valid: true`

#### AC-007 — Carrinho parcial + novo pedido excede estoque
- **Dado** a opção "Arroz com Cenoura" com estoque 5 e 3 já no carrinho
- **Quando** o cliente tenta adicionar mais 3 espetinhos
- **Então** a validação retorna `valid: false` com `availableQty: 2`

#### AC-008 — Validação em lote para todas as opções selecionadas
- **Dado** opções selecionadas onde uma tem estoque insuficiente
- **Quando** a validação em lote é executada
- **Então** retorna `valid: false` identificando o produto específico que falhou

#### AC-009 — Resolução de estoque a partir de opcoes_personalizacao
- **Dado** um produto cujas opções de personalização possuem `{ nome: "Arroz com Cenoura", quantidade: 1 }`
- **Quando** `getOptionStock` é chamado com esse nome e a lista de opções ou produto
- **Então** o estoque retornado é `1` (extraído diretamente do objeto da opção)

#### AC-010 — Bloqueio no botão '+' de quantidade quando a opção selecionada não suporta
- **Dado** o cliente já selecionou "Arroz com Cenoura" (estoque 1) com `qty = 1`
- **Quando** o cliente clica no botão `+` para tentar `qty = 2`
- **Então** a quantidade não aumenta e o modal de aviso de estoque é aberto para o "Arroz com Cenoura"

#### AC-011 — Bloqueio ao selecionar opção quando qty atual excede o estoque da opção
- **Dado** o cliente está com `qty = 2` ou mais no footer
- **Quando** o cliente clica para selecionar uma opção com estoque 1 ("Arroz com Cenoura")
- **Então** a seleção é impedida e o modal de aviso de estoque é aberto informando que só há 1 unidade disponível

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | O estoque de arroz reside no campo `quantidade` dentro de `opcoes_personalizacao` | confirmada | Confirmado via consulta direta no banco de dados Supabase de produção |
| ASM-002 | `getOptionStock` deve suportar tanto catálogo de produtos quanto `opcoes_personalizacao` | confirmada | Permite retrocompatibilidade total com produtos avulsos e opções agrupadas |

