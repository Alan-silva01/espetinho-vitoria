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

## T-003 — Investigar e corrigir causa raiz do bug em produção [concluida]

- Refs: US-001, AC-001 a AC-008
- Arquivos: src/pages/customer/ProductPage.jsx, src/lib/stockValidator.js
- Notas: Normalização de acentos/substring aplicada no stockValidator; integrado diretamente com validateAllOptions e mapeamento correto de props no StockWarningModal. 17/17 testes passando e build OK.

