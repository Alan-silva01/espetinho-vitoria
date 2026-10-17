import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, ShoppingBag, Bike, CreditCard, Banknote, QrCode, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { calculateOrderTotals } from '../../lib/orderCalculation'
import './EditOrderDetailsSheet.css'

export default function EditOrderDetailsSheet({ isOpen, order, onClose, onSave }) {
    if (!isOpen || !order) return null

    const [tipoPedido, setTipoPedido] = useState(order.tipo_pedido || 'retirada')
    const [taxaEntrega, setTaxaEntrega] = useState(Number(order.taxa_entrega) || 0)
    const [formaPagamento, setFormaPagamento] = useState(order.forma_pagamento || 'pix')
    const [trocoPara, setTrocoPara] = useState(order.troco_para ? String(order.troco_para) : '')
    const [isentoTaxaCartao, setIsentoTaxaCartao] = useState(false)
    
    const [deliveryFees, setDeliveryFees] = useState([])
    const [config, setConfig] = useState({})
    const [loadingFees, setLoadingFees] = useState(false)
    const [saving, setSaving] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)

    // Load store config and delivery fees
    useEffect(() => {
        let isMounted = true

        async function loadConfigAndFees() {
            setLoadingFees(true)
            try {
                const [cfgRes, feesRes] = await Promise.all([
                    supabase.from('configuracoes').select('*').single(),
                    supabase.from('taxas_entrega').select('*').eq('ativo', true).order('local')
                ])

                if (isMounted) {
                    if (cfgRes.data) setConfig(cfgRes.data)
                    if (feesRes.data) setDeliveryFees(feesRes.data)
                }
            } catch (err) {
                console.error('[EditOrderDetailsSheet] Erro ao carregar configurações/taxas:', err)
            } finally {
                if (isMounted) setLoadingFees(false)
            }
        }

        loadConfigAndFees()
        return () => { isMounted = false }
    }, [])

    // Recalculate preview totals
    const totals = useMemo(() => {
        return calculateOrderTotals({
            subtotal: order.subtotal,
            tipoPedido,
            taxaEntrega,
            formaPagamento,
            config,
            isentoTaxaCartao,
            trocoPara: trocoPara ? Number(trocoPara) : null
        })
    }, [order.subtotal, tipoPedido, taxaEntrega, formaPagamento, config, isentoTaxaCartao, trocoPara])

    const handleSelectDeliveryFee = (e) => {
        const val = e.target.value
        if (val === 'custom') return
        const fee = deliveryFees.find(f => String(f.id) === String(val))
        if (fee) {
            setTaxaEntrega(Number(fee.valor_frete))
        }
    }

    const handleConfirmSave = async () => {
        setSaving(true)
        try {
            const updatedFields = {
                tipo_pedido: totals.tipo_pedido,
                taxa_entrega: totals.taxa_entrega,
                forma_pagamento: totals.forma_pagamento,
                taxa_cartao: totals.taxa_cartao,
                valor_total: totals.valor_total,
                troco_para: totals.troco_para
            }

            await onSave(updatedFields)
            setShowConfirmModal(false)
            onClose()
        } catch (err) {
            console.error('[EditOrderDetailsSheet] Erro ao salvar:', err)
            alert('Erro ao salvar alterações no pedido. Verifique sua conexão.')
        } finally {
            setSaving(false)
        }
    }

    return createPortal(
        <div className="edit-order-sheet-overlay" onClick={onClose}>
            <div className="edit-order-sheet-card" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="edit-order-sheet-header">
                    <div className="edit-order-sheet-header-title">
                        <span>Editar Detalhes do Pedido #{order.numero_pedido}</span>
                    </div>
                    <button className="edit-order-sheet-close-btn" onClick={onClose} title="Fechar">
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="edit-order-sheet-body">
                    {/* Tipo de Pedido */}
                    <div className="edit-order-form-group">
                        <label className="edit-order-form-label">Tipo de Atendimento</label>
                        <div className="edit-order-segmented-control">
                            <button
                                type="button"
                                className={`edit-order-segment-btn ${tipoPedido === 'retirada' ? 'active' : ''}`}
                                onClick={() => {
                                    setTipoPedido('retirada')
                                    setTaxaEntrega(0)
                                }}
                            >
                                <ShoppingBag size={14} />
                                <span>Retirada</span>
                            </button>
                            <button
                                type="button"
                                className={`edit-order-segment-btn ${tipoPedido === 'entrega' ? 'active' : ''}`}
                                onClick={() => {
                                    setTipoPedido('entrega')
                                    if (taxaEntrega === 0 && deliveryFees.length > 0) {
                                        setTaxaEntrega(Number(deliveryFees[0].valor_frete))
                                    }
                                }}
                            >
                                <Bike size={14} />
                                <span>Entrega</span>
                            </button>
                        </div>
                    </div>

                    {/* Taxa de Entrega (se for Entrega) */}
                    {tipoPedido === 'entrega' && (
                        <div className="edit-order-form-group">
                            <label className="edit-order-form-label">Taxa de Entrega / Bairro</label>
                            <select
                                className="edit-order-select"
                                onChange={handleSelectDeliveryFee}
                                defaultValue=""
                            >
                                <option value="" disabled>Selecione um bairro ou taxa...</option>
                                {deliveryFees.map(fee => (
                                    <option key={fee.id} value={fee.id}>
                                        {fee.local} — {formatCurrency(fee.valor_frete)}
                                    </option>
                                ))}
                            </select>
                            <div style={{ marginTop: '6px' }}>
                                <label style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>Valor do Frete (R$):</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    className="edit-order-input"
                                    value={taxaEntrega}
                                    onChange={e => setTaxaEntrega(Number(e.target.value) || 0)}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                    )}

                    {/* Forma de Pagamento */}
                    <div className="edit-order-form-group">
                        <label className="edit-order-form-label">Forma de Pagamento</label>
                        <select
                            className="edit-order-select"
                            value={formaPagamento}
                            onChange={e => {
                                setFormaPagamento(e.target.value)
                                setIsentoTaxaCartao(false)
                            }}
                        >
                            <option value="pix">PIX</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cartao_credito">Cartão de Crédito</option>
                            <option value="cartao_debito">Cartão de Débito</option>
                        </select>
                    </div>

                    {/* Campo de Troco (se for Dinheiro) */}
                    {formaPagamento === 'dinheiro' && (
                        <div className="edit-order-form-group">
                            <label className="edit-order-form-label">Troco para quanto?</label>
                            <input
                                type="number"
                                step="1"
                                className="edit-order-input"
                                placeholder={`Ex: ${Math.ceil(totals.valor_total + 10)} (Deixe em branco se não precisar)`}
                                value={trocoPara}
                                onChange={e => setTrocoPara(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Opções de Cartão (Isentar taxa) */}
                    {(formaPagamento === 'cartao_credito' || formaPagamento === 'cartao_debito') && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                            <span style={{ fontSize: '12px', color: '#555' }}>Taxa da maquinha aplicada no total</span>
                            <button
                                type="button"
                                className={`edit-order-btn-exempt ${isentoTaxaCartao ? 'active' : ''}`}
                                onClick={() => setIsentoTaxaCartao(!isentoTaxaCartao)}
                            >
                                {isentoTaxaCartao ? 'Taxa Isentada' : 'Isentar Taxa de Cartão'}
                            </button>
                        </div>
                    )}

                    {/* Resumo Financeiro */}
                    <div className="edit-order-summary-box">
                        <div className="edit-order-summary-line">
                            <span>Subtotal dos Produtos:</span>
                            <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        {tipoPedido === 'entrega' && (
                            <div className="edit-order-summary-line">
                                <span>Taxa de Entrega:</span>
                                <span>{formatCurrency(totals.taxa_entrega)}</span>
                            </div>
                        )}
                        {totals.taxa_cartao > 0 && (
                            <div className="edit-order-summary-line">
                                <span>Taxa de Cartão:</span>
                                <span>{formatCurrency(totals.taxa_cartao)}</span>
                            </div>
                        )}
                        <div className="edit-order-summary-line total">
                            <span>Novo Total:</span>
                            <span>{formatCurrency(totals.valor_total)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="edit-order-sheet-footer">
                    <button type="button" className="edit-order-btn-cancel" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="edit-order-btn-save"
                        onClick={() => setShowConfirmModal(true)}
                        disabled={saving}
                    >
                        <Check size={16} />
                        <span>Salvar Alterações</span>
                    </button>
                </div>
            </div>

            {/* Modal de Confirmação antes de Salvar */}
            {showConfirmModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100000,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onClick={() => setShowConfirmModal(false)}
                >
                    <div
                        style={{
                            background: '#fff',
                            border: '1.5px solid #232220',
                            width: 340,
                            padding: 20,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <AlertCircle size={20} color="#eab308" />
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Confirmar Alterações</h4>
                        </div>
                        <p style={{ fontSize: 13, color: '#555', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                            Deseja atualizar este pedido para <strong>{tipoPedido.toUpperCase()}</strong> com pagamento via <strong>{formaPagamento}</strong> e novo total de <strong>{formatCurrency(totals.valor_total)}</strong>?
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="edit-order-btn-cancel"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={saving}
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                className="edit-order-btn-save"
                                onClick={handleConfirmSave}
                                disabled={saving}
                            >
                                {saving ? 'Salvando...' : 'Sim, Atualizar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    )
}
