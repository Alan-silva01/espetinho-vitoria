# Tasks: Redesign novo pedido kanban

> feature: redesign-novo-pedido-kanban

## T-014 — Criar e atualizar suíte de testes de especificação para visual, telefone, foto e retorno ao admin [concluida]
- Refs: US-012, AC-049, AC-050, AC-051, AC-052, AC-053, AC-054, AC-055, AC-056, AC-057
- Arquivos: test/redesign-novo-pedido-kanban.spec.test.js
- Notas: Testes automatizados com tags @spec:AC-049 a AC-057.

## T-015 — Atualizar CreateOrderModal.jsx para normalizar telefone, aplicar máscara e modal de duplicidade [concluida]
- Refs: US-012, AC-051, AC-052, AC-053, AC-055, AC-056, AC-057
- Arquivos: src/components/admin/CreateOrderModal.jsx, src/components/admin/CreateOrderModal.css, src/lib/utils.js
- Notas: Máscara dinâmica, botão verde para cadastrar, salvamento no formato WhatsApp e modal de duplicidade com botão 'Ir para o Cliente'.

## T-016 — Implementar banner de retorno ao Admin no CustomerLayout [concluida]
- Refs: US-012, AC-054
- Arquivos: src/layouts/CustomerLayout.jsx
- Notas: Detectar flag admin=true ou session storage e exibir barra superior fixa com botão direto para voltar ao Kanban (/admin/pedidos).
