# Spec: Edicao tipo pagamento pedido

> feature: edicao-tipo-pagamento-pedido
> status: pronta

## Contexto

Permitir que operadores no painel administrativo editem detalhes operacionais de pedidos ativos (retirada vs entrega, bairro/taxa de entrega, forma de pagamento, troco para dinheiro e recálculo ou isenção de taxas de cartão) com confirmação explícita e atualização imediata em tempo real sem recarregar a página.

## Histórias

### US-011 — Edição de tipo de pedido, forma de pagamento e taxas no painel administrativo

Como operador do painel administrativo,
quero editar o tipo de pedido (retirada ou entrega), a taxa de entrega e a forma de pagamento de um pedido com recálculo ou isenção de taxa de cartão e troco,
para que o cupom, relatórios e controle financeiro reflitam exatamente a realidade da transação com o cliente.

#### AC-044 — Alternar entrega para retirada zera automaticamente a taxa de frete

- **Dado** um pedido de entrega com taxa de entrega maior que zero e subtotal definido
- **Quando** o operador altera o tipo de pedido para retirada
- **Então** a taxa de entrega é recalculada como zero e o valor total do pedido é decrementado do valor anterior do frete

#### AC-045 — Selecionar cartão de crédito ou débito calcula taxa percentual sobre subtotal e frete

- **Dado** um pedido com subtotal e taxa de entrega definidos e configuração de percentuais de cartão
- **Quando** a forma de pagamento é alterada para cartão de crédito ou cartão de débito
- **Então** a taxa de cartão é calculada proporcionalmente à soma do subtotal com a taxa de entrega e somada ao valor total

#### AC-046 — Botão de isenção de taxa de cartão zera o encargo

- **Dado** um pedido com pagamento em cartão de crédito ou débito e taxa calculada
- **Quando** o operador clica no botão de isentar taxa de cartão
- **Então** a taxa de cartão passa a ser 0 e o valor total reflete apenas subtotal mais taxa de entrega

#### AC-047 — Alterar pagamento para dinheiro com troco armazena troco e zera taxa de cartão

- **Dado** um pedido com pagamento anterior em cartão
- **Quando** o operador altera para dinheiro e informa o valor para troco
- **Então** a taxa de cartão é zerada, o troco é registrado e o valor total não inclui taxa de cartão

#### AC-048 — Salvar alterações atualiza o banco e reflete imediatamente no modal em tempo real

- **Dado** o modal de edição de pedido com alterações de tipo ou pagamento confirmadas
- **Quando** o operador clica em salvar após o modal de confirmação
- **Então** os novos valores são gravados no banco e o estado local e pai do pedido são sincronizados sem necessidade de recarregar a tela

## Fora de escopo

- Alteração retroativa em pedidos com status 'cancelado' ou 'entregue' (já fechados).
- Adicionar ou remover itens do carrinho (já atendido por outras funções no modal).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | Se a configuração da loja não definir taxa de cartão, o fallback padrão é 5% para crédito e débito | confirmada | Confirmado com o padrão existente no CheckoutPage e FreightPage |

## Perguntas em aberto

Nenhuma.
