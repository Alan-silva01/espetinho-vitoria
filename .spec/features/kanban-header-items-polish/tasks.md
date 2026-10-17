# Tasks: Kanban header items polish

> feature: kanban-header-items-polish

## T-017 — Criar suíte de testes de especificação para botão de som, filtros e itens em negrito [concluida]
- Refs: US-013, AC-058, AC-059, AC-060, AC-061
- Arquivos: test/kanban-header-items-polish.spec.test.js
- Notas: Testes automatizados para validação de markup, ícone Volume2, estilização e tipografia em negrito.

## T-018 — Refatorar botão de som e ajustar filtros no cabeçalho do Kanban [concluida]
- Refs: US-013, AC-058, AC-059
- Arquivos: src/pages/admin/OrdersPage.jsx, src/pages/admin/OrdersPage.css
- Notas: Substituir botão "Ativar Som" por botão compacto icon-only com Volume2 (30x30px), adicionar tooltip e harmonizar alturas com date-trigger e search-box.

## T-019 — Aplicar destaque em negrito nos nomes dos itens do pedido no modal de detalhes e cards [concluida]
- Refs: US-013, AC-060, AC-061
- Arquivos: src/components/admin/OrderDetailModal.jsx, src/pages/admin/OrdersPage.css
- Notas: Ajustar receipt-item-title e garantir font-weight 700 no nome do produto tanto no recibo quanto no card Kanban.
