# Tasks: Custom select component

> feature: custom-select-component

## T-021 — Criar suíte de testes de especificação para CustomSelect [concluida]
- Refs: US-014, AC-063, AC-064, AC-065
- Arquivos: test/custom-select-component.spec.test.js
- Notas: Testes automatizados para props, estados, eventos e integração em EditOrderDetailsSheet.

## T-022 — Desenvolver componente CustomSelect reutilizável e estilos [concluida]
- Refs: US-014, AC-063
- Arquivos: src/components/ui/CustomSelect.jsx, src/components/ui/CustomSelect.css
- Notas: Trigger acessível, chevron com rotação suave, popover flutuante, click-outside listener e scroll estilizado.

## T-023 — Integrar CustomSelect em EditOrderDetailsSheet para Bairros e Pagamento [concluida]
- Refs: US-014, AC-064, AC-065
- Arquivos: src/components/admin/EditOrderDetailsSheet.jsx, src/components/admin/EditOrderDetailsSheet.css
- Notas: Substituir os dois selects nativos pelo CustomSelect mantendo sincronia com os handlers existentes.
