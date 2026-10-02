# Spec: Fix — Nome do cliente não reverte após edição no admin

> feature: fix-nome-cliente-revert
> status: implementado

## Contexto

A tabela `clientes` possui uma coluna principal `nome` e um campo JSONB `dados` que contém
`{ "nome": "...", "nome_recebedor": "...", "endereco": { "nome_recebedor": "..." } }`.

**Bug Reportado:** O administrador editava o nome de um cliente no painel (ex: "Joao" → "João Silva").
Porém, na próxima vez que o cliente fazia um pedido via checkout no celular, o nome voltava
para o valor antigo ("Joao"), pois:

1. O celular do cliente ainda tinha o `nome_recebedor` antigo salvo em `localStorage['espetinho_delivery_data']`.
2. O checkout usava esse `nome_recebedor` como `nome_cliente` do pedido.
3. Ao finalizar o pedido, `updateLastOrder` sobrescrevia `clientes.nome` com o `nome_cliente` antigo.
4. A edição do admin não atualizava `dados.nome_recebedor` — apenas `dados.nome` e `nome` (coluna).

## Histórias

### US-010 — Edição de nome pelo admin é preservada após novo pedido

Como administrador do Espetinho Vitória,
Quero que o nome editado de um cliente seja mantido mesmo que ele faça um novo pedido depois,
Para que os cadastros reflitam corretamente os nomes corretos sem precisar re-editar repetidamente.

#### AC-040 — handleSave sincroniza nome_recebedor no JSONB dados

- **Dado** o modal de edição de cliente no admin com um novo nome preenchido
- **Quando** o administrador clica em "Salvar Cliente"
- **Então** `dados.nome_recebedor` e `dados.endereco.nome_recebedor` são gravados
  com o mesmo valor do novo nome, além de `dados.nome` e a coluna `nome`.

#### AC-041 — updateLastOrder não sobrescreve nome já definido no banco

- **Dado** um cliente com `nome = "João Silva"` já gravado no banco (editado pelo admin)
- **Quando** o cliente finaliza um pedido e `updateLastOrder` é chamado com `extraInfo.nome = "Joao"` (nome antigo do cache)
- **Então** a função verifica o nome atual no banco antes de atualizar e **não sobrescreve** pois o banco já tem um nome definido.

#### AC-042 — updateLastOrder preenche o nome se o cliente ainda não tem nome cadastrado

- **Dado** um cliente recém-criado com `nome = ""` (em branco) no banco
- **Quando** o cliente finaliza seu primeiro pedido e `updateLastOrder` é chamado com `extraInfo.nome = "Maria"`
- **Então** a função atualiza `clientes.nome = "Maria"` pois o banco estava vazio.

#### AC-043 — updateLastOrder não propaga nome para o JSONB dados via updateCustomerData

- **Dado** que `extraInfo.nome` foi removido do `updateObj` antes de chamar `updateCustomerData`
- **Quando** `updateCustomerData` é executado
- **Então** `dados.nome` no JSONB não é sobrescrito pelo nome_recebedor antigo vindo do checkout.

## Fora de escopo

- Alteração do formulário de endereço no checkout do cliente.
- Limpeza manual do localStorage no celular do cliente.
- Migração retroativa de clientes com dados.nome_recebedor desatualizado.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-010 | O nome editado pelo admin deve ter sempre prioridade sobre o cache do celular do cliente | confirmada | Implementado via verificação do banco em `updateLastOrder` antes de sobrescrever |
| ASM-011 | Se o cliente ainda não tem nome (campo vazio), é legítimo deixar o checkout definir o nome | confirmada | `if (!nomeNoBanco)` permite gravar o nome apenas nesse caso |
| ASM-012 | Sincronizar `dados.nome_recebedor` na edição do admin é suficiente para resolver o ciclo de sobrescrita | confirmada | Ao editar pelo admin, todos os campos de nome no JSONB são atualizados |

## Perguntas em aberto

Nenhuma.
