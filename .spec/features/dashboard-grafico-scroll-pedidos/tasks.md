# Tasks: Dashboard grafico expandido e scroll infinito de pedidos

> feature: dashboard-grafico-scroll-pedidos

## T-006 — Criar funções utilitárias para pedidos do dia e formatação sem hash [concluida]
- Refs: US-004, AC-013, AC-015
- Arquivos: src/lib/dashboardOrderUtils.js
- Notas: formatOrderNumberWithoutHash e filterTodayOrders respeitando fuso de São Paulo.

## T-007 — Criar suíte de testes automatizados com cobertura @spec [concluida]
- Refs: US-003, US-004, AC-012, AC-013, AC-014, AC-015, AC-016
- Arquivos: test/dashboard-grafico-scroll-pedidos.spec.test.js
- Notas: Testes de unidade e renderização dos critérios de aceite com anotações @spec:AC-xxx.

## T-008 — Atualizar DashboardPage.jsx com gráfico 100% expandido e trilho de pedidos do dia [concluida]
- Refs: US-003, US-004, AC-012, AC-013, AC-014, AC-015, AC-016
- Arquivos: src/pages/admin/DashboardPage.jsx
- Notas: Remover a coluna lateral de últimos pedidos, expandir o gráfico e inserir o carrossel horizontal contínuo com scroll infinito abaixo do gráfico.

## T-009 — Estilizar o gráfico expandido e o carrossel de scroll horizontal contínuo [concluida]
- Refs: US-003, US-004, AC-012, AC-016
- Arquivos: src/pages/admin/DashboardPage.css
- Notas: Estilos responsivos, trilho horizontal de rolagem fluida, scrollbars customizadas/ocultas e cards modernos para light e dark mode.
