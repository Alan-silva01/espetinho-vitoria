# Tasks: Edicao tipo pagamento pedido

> feature: edicao-tipo-pagamento-pedido

## T-010 — Implementar funções puras de cálculo de pedido (tipo, entrega, cartão e troco) [concluida]
- Refs: US-011, AC-044, AC-045, AC-046, AC-047
- Arquivos: src/lib/orderCalculation.js, test/edicao-tipo-pagamento-pedido.spec.test.js
- Notas: Criar módulo de cálculo puro e testes automatizados TDD com tags @spec:AC-044 a AC-047.

## T-011 — Adicionar método updateOrderDetails no hook useOrders [concluida]
- Refs: US-011, AC-048
- Arquivos: src/hooks/useOrders.js
- Notas: Implementar atualização em pedidos no Supabase com suporte a tipo_pedido, taxa_entrega, forma_pagamento, taxa_cartao, troco_para, valor_total e endereço/bairro quando aplicável.

## T-012 — Criar componente EditOrderDetailsSheet e modal de confirmação [concluida]
- Refs: US-011, AC-044, AC-045, AC-046, AC-047, AC-048
- Arquivos: src/components/admin/EditOrderDetailsSheet.jsx, src/components/admin/EditOrderDetailsSheet.css
- Notas: Componente com design padronizado, alternância entrega/retirada, seleção de bairro/taxa de entrega, escolha de forma de pagamento, troco para dinheiro, toggle/botão de isenção de taxa de cartão e modal de confirmação ao salvar.

## T-013 — Integrar botão de edição e atualização em tempo real no OrderDetailModal [concluida]
- Refs: US-011, AC-048
- Arquivos: src/components/admin/OrderDetailModal.jsx
- Notas: Exibir botão de edição no recibo, acionar EditOrderDetailsSheet e atualizar localOrder e onOrderUpdated imediatamente sem recarregar a página.
