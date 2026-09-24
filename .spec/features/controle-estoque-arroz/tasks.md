# Tasks: Controle de estoque arroz

> feature: controle-estoque-arroz

## T-001 — Criar funções puras de validação de estoque [concluida]

- Refs: US-001, AC-001 a AC-008
- Arquivos: src/lib/stockValidator.js
- Notas: Funções puras sem dependência de React. Lógica extraída do ProductPage.jsx.

## T-002 — Criar testes TDD para validação de estoque [concluida]

- Refs: US-001, AC-001 a AC-008
- Arquivos: test/controle-estoque-arroz.spec.test.js
- Notas: Cada AC tem um teste correspondente com tag @spec:AC-xxx.

## T-004 — Implementar suporte a estoque de opções no stockValidator [concluida]

- Refs: US-001, AC-009
- Arquivos: src/lib/stockValidator.js, test/controle-estoque-arroz.spec.test.js
- Notas: Permitir que getOptionStock e validateOptionStock resolvam o estoque a partir das opções do próprio produto ou grupo de opções (campo `quantidade`), além do catálogo. Testes @spec:AC-009 verdes.

## T-005 — Integrar validação antecipada no ProductPage (Botão + e Seleção de Opção) [concluida]

- Refs: US-001, AC-010, AC-011
- Arquivos: src/pages/customer/ProductPage.jsx, test/controle-estoque-arroz.spec.test.js
- Notas: Acionamento de validação no botão + de quantidade e no clique de seleção de opção, bloqueando e abrindo o StockWarningModal quando a quantidade requisitada exceder o disponível. 21/21 testes passando e build OK.

