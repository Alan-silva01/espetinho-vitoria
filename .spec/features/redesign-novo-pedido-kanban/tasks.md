# Tasks: Redesign novo pedido kanban

> feature: redesign-novo-pedido-kanban

## T-014 — Criar e atualizar suíte de testes de especificação para visual, telefone, foto e retorno ao admin [pendente]

- Refs: US-012, AC-049, AC-050, AC-051, AC-052, AC-053, AC-054
- Arquivos: test/redesign-novo-pedido-kanban.spec.test.js
- Notas: Testes automatizados com tags @spec:AC-049 a AC-054.

## T-015 — Atualizar CreateOrderModal.jsx para carregar foto (avatr_url), formatar telefone e utilizar botão verde [pendente]

- Refs: US-012, AC-051, AC-052, AC-053
- Arquivos: src/components/admin/CreateOrderModal.jsx, src/components/admin/CreateOrderModal.css
- Notas: Ajustar select no Supabase para buscar avatr_url e dados, aplicar formatPhoneDisplay e estilizar botão verde.

## T-016 — Implementar banner de retorno ao Admin no CustomerLayout [pendente]

- Refs: US-012, AC-054
- Arquivos: src/layouts/CustomerLayout.jsx
- Notas: Detectar flag admin=true ou session storage e exibir barra superior fixa com botão direto para voltar ao Kanban (/admin/pedidos).
