# Tasks: Fix tela preta

> feature: fix-tela-preta

## T-001 — Remover top-level await do App.jsx [concluida]

- Refs: US-001, AC-001, AC-002
- Arquivos: src/App.jsx
- Notas: Substituir TLA por IIFE async. Lógica idêntica, só muda o escopo do await.

## T-002 — Adicionar fallback HTML no index.html [concluida]

- Refs: US-001, AC-003
- Arquivos: index.html
- Notas: Conteúdo estático dentro do div#root — React substitui ao montar.

## T-003 — Extrair estilos do OptimizedImage para CSS [concluida]

- Refs: US-002, AC-004
- Arquivos: src/components/ui/OptimizedImage.jsx, src/components/ui/OptimizedImage.css
- Notas: Remover tag style jsx e importar CSS externo.
