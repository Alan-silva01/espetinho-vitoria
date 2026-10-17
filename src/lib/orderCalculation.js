/**
 * orderCalculation.js
 * Funções utilitárias puras para cálculo de totais, taxas de cartão e entrega.
 */

export function calculateCardFee({
    subtotal = 0,
    taxaEntrega = 0,
    formaPagamento = 'pix',
    config = {},
    isentoTaxaCartao = false
}) {
    if (isentoTaxaCartao) return 0

    const isCartao = formaPagamento === 'cartao_credito' || formaPagamento === 'cartao_debito'
    if (!isCartao) return 0

    const pctCredito = config?.taxa_cartao_credito !== undefined && config?.taxa_cartao_credito !== null
        ? Number(config.taxa_cartao_credito)
        : 5
    const pctDebito = config?.taxa_cartao_debito !== undefined && config?.taxa_cartao_debito !== null
        ? Number(config.taxa_cartao_debito)
        : 5

    const pct = formaPagamento === 'cartao_credito' ? pctCredito : pctDebito
    if (pct <= 0) return 0

    const base = Number(subtotal) + Number(taxaEntrega)
    return Math.round(base * (pct / 100) * 100) / 100
}

export function calculateOrderTotals({
    subtotal = 0,
    tipoPedido = 'retirada',
    taxaEntrega = 0,
    formaPagamento = 'pix',
    config = {},
    isentoTaxaCartao = false,
    trocoPara = null
}) {
    const finalSubtotal = Number(subtotal) || 0
    const finalTaxaEntrega = tipoPedido === 'retirada' ? 0 : (Number(taxaEntrega) || 0)

    const finalTaxaCartao = calculateCardFee({
        subtotal: finalSubtotal,
        taxaEntrega: finalTaxaEntrega,
        formaPagamento,
        config,
        isentoTaxaCartao
    })

    const finalTotal = Math.round((finalSubtotal + finalTaxaEntrega + finalTaxaCartao) * 100) / 100

    const finalTroco = formaPagamento === 'dinheiro' && trocoPara
        ? Number(trocoPara)
        : null

    return {
        subtotal: finalSubtotal,
        taxa_entrega: finalTaxaEntrega,
        taxa_cartao: finalTaxaCartao,
        valor_total: finalTotal,
        troco_para: finalTroco,
        tipo_pedido: tipoPedido,
        forma_pagamento: formaPagamento
    }
}
