# Spec: Custom select component

> feature: custom-select-component
> status: pronta

## Contexto

Substituição dos elementos nativos `<select>` do navegador por um componente `CustomSelect` estilizado, elegante e desacoplado, com controle de estado, click-outside dismiss, suporte a ícone, visual alinhado ao design system e scroll customizado no modal Editar Detalhes do Pedido (taxa de entrega/bairro e forma de pagamento).

## Histórias

### US-014 — Componente CustomSelect para substituição de selects nativos

Como operador do painel administrativo,
Quero selecionar bairros, taxas e formas de pagamento através de um dropdown customizado e elegante com a identidade visual do sistema,
Para que a interface não dependa dos popovers nativos feios e inconsistentes dos navegadores/sistemas operacionais.

#### AC-063 — Componente CustomSelect com trigger, popover e click-outside
- **Dado** que o componente CustomSelect é renderizado
- **Quando** o usuário clica no trigger (botão de ancoragem)
- **Então** o menu suspenso deve abrir com animação suave, destacar o item ativo e fechar ao selecionar ou ao clicar fora (click-outside).

#### AC-064 — Seleção de Taxa de Entrega / Bairro usando CustomSelect
- **Dado** que o modal Editar Detalhes do Pedido (EditOrderDetailsSheet) está aberto para um pedido de entrega
- **Quando** o operador clica no seletor de Bairro/Taxa
- **Então** as opções de bairro e seus respectivos valores devem ser renderizadas através do CustomSelect e atualizar a taxa de entrega imediatamente ao selecionar.

#### AC-065 — Seleção de Forma de Pagamento usando CustomSelect
- **Dado** que o operador edita os detalhes do pedido
- **Quando** ele escolhe a Forma de Pagamento (PIX, Dinheiro, Cartão de Crédito, Cartão de Débito)
- **Então** a escolha deve ser feita via CustomSelect mantendo a lógica de recálculo de troco e taxas intacta.

## Fora de escopo

- Alteração das regras de cálculo de taxa de cartão ou frete da API.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-003 | Lucide-react possui o ícone ChevronDown para o indicador do dropdown | confirmada | lucide-react já é dependência do projeto |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-003 | O CustomSelect deve ter busca interna ou apenas lista? | respondida | CustomSelect simples com scroll controlado |
