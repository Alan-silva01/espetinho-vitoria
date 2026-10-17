import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateCardFee, calculateOrderTotals } from '../src/lib/orderCalculation.js'

// AC-044 — Alternar entrega para retirada zera automaticamente a taxa de frete
test('AC-044: Alternar entrega para retirada zera taxa_entrega e deduz do total @spec:AC-044', () => {
    const result = calculateOrderTotals({
        subtotal: 50,
        tipoPedido: 'retirada',
        taxaEntrega: 10,
        formaPagamento: 'pix',
    })

    assert.equal(result.tipo_pedido, 'retirada')
    assert.equal(result.taxa_entrega, 0, 'Taxa de entrega deve ser zero para retirada')
    assert.equal(result.valor_total, 50, 'Total deve ser igual apenas ao subtotal')
})

// AC-045 — Selecionar cartão de crédito ou débito calcula taxa percentual sobre subtotal e frete
test('AC-045: Cartão de crédito calcula taxa percentual sobre subtotal + entrega @spec:AC-045', () => {
    const config = { taxa_cartao_credito: 10, taxa_cartao_debito: 5 }
    
    // Subtotal 100 + Entrega 20 = Base 120. Com 10% de crédito = taxa de 12. Total = 132
    const result = calculateOrderTotals({
        subtotal: 100,
        tipoPedido: 'entrega',
        taxaEntrega: 20,
        formaPagamento: 'cartao_credito',
        config
    })

    assert.equal(result.taxa_cartao, 12, 'Taxa de cartão deve ser 10% de 120 = 12')
    assert.equal(result.valor_total, 132, 'Valor total deve ser 100 + 20 + 12 = 132')
})

// AC-046 — Botão de isenção de taxa de cartão zera o encargo
test('AC-046: Isenção de taxa de cartão zera encargo e deduz do total @spec:AC-046', () => {
    const config = { taxa_cartao_credito: 10 }
    
    const result = calculateOrderTotals({
        subtotal: 100,
        tipoPedido: 'entrega',
        taxaEntrega: 10,
        formaPagamento: 'cartao_credito',
        config,
        isentoTaxaCartao: true
    })

    assert.equal(result.taxa_cartao, 0, 'Taxa de cartão deve ser zero quando isento')
    assert.equal(result.valor_total, 110, 'Valor total deve ser 100 + 10 = 110')
})

// AC-047 — Alterar pagamento para dinheiro com troco armazena troco e zera taxa de cartão
test('AC-047: Dinheiro com troco zera taxa de cartão e armazena troco @spec:AC-047', () => {
    const result = calculateOrderTotals({
        subtotal: 45,
        tipoPedido: 'retirada',
        taxaEntrega: 0,
        formaPagamento: 'dinheiro',
        trocoPara: 50
    })

    assert.equal(result.taxa_cartao, 0, 'Taxa de cartão deve ser 0 para dinheiro')
    assert.equal(result.troco_para, 50, 'Troco para deve ser 50')
    assert.equal(result.valor_total, 45, 'Total deve ser 45')
})

// AC-048 — Salvar alterações atualiza o banco e reflete imediatamente no modal em tempo real
test('AC-048: Objeto de totais gerado é consistente para sincronização em tempo real @spec:AC-048', () => {
    const result = calculateOrderTotals({
        subtotal: 75.5,
        tipoPedido: 'entrega',
        taxaEntrega: 8.5,
        formaPagamento: 'cartao_debito',
        config: { taxa_cartao_debito: 5 }
    })

    // Base = 84. 5% de 84 = 4.2. Total = 88.2
    assert.equal(result.subtotal, 75.5)
    assert.equal(result.taxa_entrega, 8.5)
    assert.equal(result.taxa_cartao, 4.2)
    assert.equal(result.valor_total, 88.2)
})
