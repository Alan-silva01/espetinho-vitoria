# Tarefa: Controle de Estoque de Sucos por Sabor (Copos e Jarras Unificados)

## 1. Visão Geral
Unificar o gerenciamento de estoque dos sucos no painel administrativo (`InventoryPage.jsx`) com:
- Aba dedicada e unificada **"Sucos"** com visualização separada por **Copos** e **Jarras**.
- **Copos (Suco Natural):** Campo de quantidade numérica (`und`) + toggle Liga/Desliga para cada sabor (Acerola, Caju, Maracujá, Cajá, Laranja, etc.).
- **Jarras (Jarra de Suco):** Toggle Liga/Desliga por sabor.
- **Regra de Sincronização:** Se o sabor do copo zerar ou for desativado, o sabor na Jarra é desativado automaticamente. Se o copo for reabastecido (`> 0`), a Jarra daquele sabor é reativada automaticamente.
- **Cardápio e Validação:** `ProductPage.jsx`, `stockValidator.js` e `CheckoutPage.jsx` refletem a quantidade de copos e o status da jarra.
- **Baixa Automática:** Ao vender copo de suco, o sistema desconta a quantidade do sabor respectivo em `opcoes_personalizacao` (e se chegar a zero, esgota no copo e na jarra).
