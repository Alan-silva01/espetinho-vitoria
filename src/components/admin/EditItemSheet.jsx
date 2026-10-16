/**
 * EditItemSheet — Modal to edit an existing order item.
 * Pre-populates with the existing item's variation, personalizacao, qty and notes.
 * Shares the same product customization logic as AddItemSheet.
 */
import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Minus, Check, AlertCircle, ArrowLeft, Pencil } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useInventory } from '../../hooks/useInventory'
import { formatCurrency } from '../../lib/utils'
import './AddItemSheet.css' // Reuse the same styles

// ─── Option helpers ──────────────────────────────────────────────────────────
const optName = (opt) => (typeof opt === 'string' ? opt : opt.nome || opt.name || '')
const optPreco = (opt) => {
    if (typeof opt === 'string') return 0
    const val = opt.preco !== undefined ? opt.preco : opt.price
    return Number(val) || 0
}

export default function EditItemSheet({ isOpen, item, order, onClose, onConfirmEdit }) {
    const { products, loading: loadingProducts } = useProducts()
    const { inventory: _inventory } = useInventory()

    // The product object to use: from item._product (optimistic) or find in products
    const [targetProduct, setTargetProduct] = useState(null)
    const [selectedVariation, setSelectedVariation] = useState(null)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [quantity, setQuantity] = useState(1)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    // ── Populate state from item when modal opens ────────────────────────────
    useEffect(() => {
        if (!isOpen || !item) return

        setQuantity(item.quantidade || 1)
        setNotes(item.observacoes || '')
        setErrorMessage('')

        // Find product from catalog
        const prod = item._product || products?.find(p => p.id === item.produto_id) || null
        setTargetProduct(prod)

        if (prod) {
            // Variation: find by variacao_id
            let matchVariation = null
            if (item.variacao_id && prod.variacoes_produto?.length) {
                matchVariation = prod.variacoes_produto.find(v => v.id === item.variacao_id) || null
            }
            setSelectedVariation(matchVariation)

            // Personalizacao: restore from item
            if (item.personalizacao && typeof item.personalizacao === 'object') {
                setSelectedOptions({ ...item.personalizacao })
            } else {
                setSelectedOptions({})
            }
        }
    }, [isOpen, item, products])

    // When product loads from catalog (async), re-resolve if needed
    useEffect(() => {
        if (!isOpen || !item || targetProduct) return
        const prod = products?.find(p => p.id === item.produto_id) || null
        if (prod) setTargetProduct(prod)
    }, [products, isOpen, item, targetProduct])

    const handleClose = () => {
        setTargetProduct(null)
        setSelectedVariation(null)
        setSelectedOptions({})
        setQuantity(1)
        setNotes('')
        setErrorMessage('')
        onClose()
    }

    // ── Option availability check (same logic as AddItemSheet) ───────────────
    const checkOptionAvailable = (opt, groupName) => {
        if (!opt) return false
        if (typeof opt === 'object' && opt.disponivel === false) return false
        if (typeof opt === 'object' && opt.quantidade !== undefined && opt.quantidade !== null && opt.quantidade !== '') {
            if (Number(opt.quantidade) <= 0) return false
        }

        const rawName = typeof opt === 'string' ? opt : (opt.nome || opt.name)
        if (!rawName) return true
        const nameStr = rawName.toLowerCase()

        // Açaí global rule
        const catName = targetProduct?.categorias?.nome || targetProduct?.categoria?.nome
        if (catName === 'Açaí' && products?.length > 0) {
            for (const p of products) {
                const pCat = p.categorias?.nome || p.categoria?.nome
                if (pCat === 'Açaí' && p.opcoes_personalizacao) {
                    for (const g of p.opcoes_personalizacao) {
                        if (['escolha', 'fruta', 'adicionais', 'acompanha'].some(kw => (g.grupo || '').toLowerCase().includes(kw))) {
                            const match = g.opcoes?.find(o => {
                                const pName = typeof o === 'string' ? o : (o.nome || o.name)
                                return String(pName).toLowerCase() === nameStr
                            })
                            if (match && typeof match !== 'string') {
                                if (match.disponivel === false) return false
                                if (match.quantidade !== undefined && match.quantidade !== null && Number(match.quantidade) <= 0) return false
                            }
                        }
                    }
                }
            }
        }

        // Arroz rule
        const isArroz = (groupName || '').toLowerCase().includes('arroz')
        if (isArroz && products?.length > 0) {
            for (const p of products) {
                if (p.opcoes_personalizacao) {
                    for (const g of p.opcoes_personalizacao) {
                        if ((g.grupo || '').toLowerCase().includes('arroz')) {
                            const match = g.opcoes?.find(o => {
                                const pName = typeof o === 'string' ? o : (o.nome || o.name)
                                return String(pName).toLowerCase() === nameStr
                            })
                            if (match && typeof match !== 'string') {
                                if (match.disponivel === false) return false
                                if (match.quantidade !== undefined && match.quantidade !== null && Number(match.quantidade) <= 0) return false
                            }
                        }
                    }
                }
            }
        }

        // Independent catalog product rule
        if (products?.length > 0) {
            const matchingProd = products.find(p => p?.nome && String(p.nome).toLowerCase() === nameStr && p.id !== targetProduct?.id)
            if (matchingProd) {
                if (matchingProd.disponivel === false) return false
                if (matchingProd.controlar_estoque && (matchingProd.quantidade_disponivel || 0) <= 0) return false
            }
        }

        return true
    }

    // ── Price calculation ────────────────────────────────────────────────────
    const hasPriceReplacement = useMemo(() => {
        if (!targetProduct?.opcoes_personalizacao) return false
        if (targetProduct.variacoes_produto?.length > 0) return false
        return targetProduct.opcoes_personalizacao.some(g => {
            const gLower = (g.grupo || '').toLowerCase()
            const isSingle = g.tipo === 'radio' || gLower.includes('tamanho') || gLower.includes('tipo') || g.maximo === 1
            return isSingle && g.opcoes?.some(opt => optPreco(opt) > 0)
        })
    }, [targetProduct])

    const extrasTotal = useMemo(() => {
        if (!targetProduct?.opcoes_personalizacao) return 0
        let total = 0
        targetProduct.opcoes_personalizacao.forEach(group => {
            const groupLower = (group.grupo || '').toLowerCase()
            const isSingle = group.tipo === 'radio' || groupLower.includes('tamanho') || groupLower.includes('tipo') || group.maximo === 1
            if (hasPriceReplacement && isSingle && group.opcoes?.some(opt => optPreco(opt) > 0)) return
            const selected = selectedOptions[group.grupo]
            if (!selected) return
            group.opcoes.forEach(opt => {
                const name = optName(opt)
                const price = optPreco(opt)
                if (price <= 0) return
                if (isSingle && selected === name) total += price
                else if (Array.isArray(selected)) {
                    const count = selected.filter(i => i === name).length
                    total += price * count
                }
            })
        })
        return total
    }, [targetProduct, selectedOptions, hasPriceReplacement])

    const unitPrice = useMemo(() => {
        if (!targetProduct) return Number(item?.preco_unitario) || 0
        let basePrice = Number(targetProduct.preco || 0)
        if (selectedVariation?.preco !== undefined && selectedVariation?.preco !== null) {
            basePrice = Number(selectedVariation.preco)
        } else if (hasPriceReplacement && targetProduct.opcoes_personalizacao) {
            for (const group of targetProduct.opcoes_personalizacao) {
                const groupLower = (group.grupo || '').toLowerCase()
                const isSingle = group.tipo === 'radio' || groupLower.includes('tamanho') || groupLower.includes('tipo') || group.maximo === 1
                if (isSingle && group.opcoes?.some(opt => optPreco(opt) > 0)) {
                    const selected = selectedOptions[group.grupo]
                    const selectedOpt = group.opcoes.find(opt => optName(opt) === selected)
                    if (selectedOpt && optPreco(selectedOpt) > 0) basePrice = optPreco(selectedOpt)
                    break
                }
            }
        }
        return basePrice + extrasTotal
    }, [targetProduct, selectedVariation, extrasTotal, hasPriceReplacement, selectedOptions, item])

    // Card fee calculation for preview
    const isCardPayment = order?.forma_pagamento?.toLowerCase().includes('cartao')
    const currentSubtotal = Number(order?.subtotal) || 0
    const currentEntrega = Number(order?.taxa_entrega) || 0
    const currentCardFee = Number(order?.taxa_cartao) || 0
    const base = currentSubtotal + currentEntrega
    const taxaPct = isCardPayment && base > 0 ? currentCardFee / base : 0
    const newSubtotal = unitPrice * quantity
    const newCardFee = isCardPayment ? newSubtotal * taxaPct : 0
    const newTotal = newSubtotal + newCardFee

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleToggleCheckboxOption = (group, opt) => {
        const name = optName(opt)
        const groupName = group.grupo
        const maximo = group.maximo
        setSelectedOptions(prev => {
            const cur = Array.isArray(prev[groupName]) ? prev[groupName] : []
            if (cur.includes(name)) return { ...prev, [groupName]: cur.filter(i => i !== name) }
            if (maximo && cur.length >= maximo) return { ...prev, [groupName]: [...cur.slice(1), name] }
            return { ...prev, [groupName]: [...cur, name] }
        })
    }

    const handleSelectRadioOption = (group, opt) => {
        const name = optName(opt)
        setSelectedOptions(prev => ({ ...prev, [group.grupo]: prev[group.grupo] === name ? '' : name }))
    }

    // ── Validation ────────────────────────────────────────────────────────────
    const validationMessage = useMemo(() => {
        if (!targetProduct) return null
        if (!targetProduct.opcoes_personalizacao) return null
        for (const group of targetProduct.opcoes_personalizacao) {
            const groupName = group.grupo?.toLowerCase() || ''
            if (groupName.includes('escolha')) {
                const match = groupName.match(/escolha\s*(\d+)/i)
                if (match) {
                    const required = parseInt(match[1])
                    const current = selectedOptions[group.grupo]
                    const count = Array.isArray(current) ? current.length : 0
                    if (count !== required) {
                        const remaining = required - count
                        return remaining > 0 ? `Selecione mais ${remaining} em "${group.grupo}"` : `Selecione ${required} em "${group.grupo}"`
                    }
                }
            }
        }
        const isCompleto = selectedVariation?.nome?.toLowerCase().includes('completo')
        if (isCompleto && targetProduct.opcoes_personalizacao) {
            const arrozGroup = targetProduct.opcoes_personalizacao.find(g =>
                ['arroz', 'tipo de arroz'].some(kw => g.grupo.toLowerCase().includes(kw))
            )
            if (arrozGroup) {
                const sel = selectedOptions[arrozGroup.grupo]
                if (!sel || (Array.isArray(sel) && sel.length === 0)) return 'Escolha o tipo de arroz'
            }
        }
        return null
    }, [targetProduct, selectedVariation, selectedOptions])

    const handleConfirm = async () => {
        const msg = validationMessage
        if (msg) { setErrorMessage(msg); return }
        setSubmitting(true)
        setErrorMessage('')
        try {
            await onConfirmEdit({
                quantidade: quantity,
                preco_unitario: unitPrice,
                variacao_id: selectedVariation?.id || null,
                personalizacao: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
                observacoes: notes.trim() || null,
                _variation: selectedVariation || null,
            })
        } catch (err) {
            console.error('[EditItemSheet] Erro:', err)
            setErrorMessage(err.message || 'Erro ao salvar alterações.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen || !item) return null

    const productName = targetProduct?.nome || item.produtos?.nome || 'Item'
    const groups = targetProduct?.opcoes_personalizacao || []
    const variations = targetProduct?.variacoes_produto || []

    return createPortal(
        <div className="add-item-overlay" onClick={handleClose}>
            <div className="add-item-modal-exact" onClick={e => e.stopPropagation()}>
                {/* TOPO ESCURO ESTILO RECIBO */}
                <div className="add-item-top-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Pencil size={15} color="#e5e5e5" />
                        <span className="add-item-top-title">EDITAR ITEM DO PEDIDO</span>
                    </div>
                    <div className="add-item-top-right">
                        <span className="add-item-top-number">N - {order?.numero_pedido}</span>
                        <button className="add-item-top-close-btn" onClick={handleClose} title="Fechar">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {loadingProducts && !targetProduct ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#737373', fontSize: 13 }}>
                        Carregando detalhes do produto...
                    </div>
                ) : (
                    <div className="add-item-customizer-scroll">
                        {/* CABEÇALHO DO PRODUTO */}
                        <div className="add-item-selected-header">
                            <div className="add-item-icon-box" style={{ width: 44, height: 44 }}>
                                {targetProduct?.imagem_url ? (
                                    <img src={targetProduct.imagem_url} alt={productName} className="add-item-product-img" style={{ width: 40, height: 40 }} />
                                ) : (
                                    <span className="add-item-icon-fallback">🍢</span>
                                )}
                            </div>
                            <div>
                                <h4 className="add-item-selected-title">{productName}</h4>
                                <span className="add-item-selected-cat">{targetProduct?.categorias?.nome || 'Item do Cardápio'}</span>
                            </div>
                        </div>

                        {/* 1. VARIAÇÕES DE PRODUTO */}
                        {variations.length > 0 && (
                            <div className="add-item-group-block">
                                <div className="add-item-group-header">
                                    <span className="add-item-group-title">ESCOLHA O TIPO / TAMANHO</span>
                                    <span className="add-item-group-badge">OBRIGATÓRIO</span>
                                </div>
                                <div className="add-item-options-list">
                                    {variations.map(v => {
                                        const isSelected = selectedVariation?.id === v.id
                                        return (
                                            <div
                                                key={v.id}
                                                className={`add-item-option-row ${isSelected ? 'active' : ''}`}
                                                onClick={() => setSelectedVariation(v)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div className={`add-item-radio-indicator ${isSelected ? 'checked' : ''}`} />
                                                    <span className="add-item-option-name">{v.nome}</span>
                                                </div>
                                                <span className="add-item-option-price">{formatCurrency(v.preco)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 2. GRUPOS DE PERSONALIZAÇÃO (Acompanhamentos, Sabores, Frutas, Adicionais Pagos) */}
                        {groups.map((group, gIdx) => {
                            const groupLower = (group.grupo || '').toLowerCase()
                            const isRadio = group.tipo === 'radio' ||
                                groupLower.includes('tamanho') ||
                                groupLower.includes('tipo') ||
                                group.maximo === 1
                            const currentSel = selectedOptions[group.grupo]
                            const productHasCompleto = variations.some(v => v.nome.toLowerCase().includes('completo'))
                            const isCompleto = selectedVariation?.nome?.toLowerCase().includes('completo')
                            const isAccompaniment = ['acompanha', 'incluso', 'acompanhamento'].some(kw => group.grupo.toLowerCase().includes(kw))
                            const isArroz = ['arroz', 'tipo de arroz'].some(kw => group.grupo.toLowerCase().includes(kw))
                            const isDisabledByVariation = productHasCompleto && selectedVariation && !isCompleto && (isAccompaniment || isArroz)

                            if (isDisabledByVariation) return null

                            const availableOpts = group.opcoes?.filter(opt => checkOptionAvailable(opt, group.grupo)) || []
                            if (availableOpts.length === 0) return null

                            return (
                                <div key={gIdx} className="add-item-group-block">
                                    <div className="add-item-group-header">
                                        <span className="add-item-group-title">{group.grupo}</span>
                                        {group.maximo && <span className="add-item-group-badge">MÁX {group.maximo}</span>}
                                    </div>

                                    <div className="add-item-options-list">
                                        {availableOpts.map((opt, oIdx) => {
                                            const name = optName(opt)
                                            const price = optPreco(opt)
                                            const isSelected = isRadio
                                                ? currentSel === name
                                                : Array.isArray(currentSel) && currentSel.includes(name)

                                            return (
                                                <div
                                                    key={oIdx}
                                                    className={`add-item-option-row ${isSelected ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setErrorMessage('')
                                                        isRadio ? handleSelectRadioOption(group, opt) : handleToggleCheckboxOption(group, opt)
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div className={`add-item-${isRadio ? 'radio' : 'checkbox'}-indicator ${isSelected ? 'checked' : ''}`}>
                                                            {isSelected && !isRadio && <Check size={12} strokeWidth={3} />}
                                                        </div>
                                                        <span className="add-item-option-name">{name}</span>
                                                    </div>
                                                    {price > 0 ? (
                                                        <span className="add-item-option-price">+{formatCurrency(price)}</span>
                                                    ) : (
                                                        <span className="add-item-option-free">Grátis</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}

                        {/* 3. CAMPO DE OBSERVAÇÃO DO ITEM */}
                        <div className="add-item-group-block">
                            <span className="add-item-group-title">OBSERVAÇÕES DO ITEM (OPCIONAL)</span>
                            <input
                                type="text"
                                className="add-item-obs-input"
                                placeholder="Ex: sem cebola, bem passado..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* BANNER DE ERRO / VALIDAÇÃO */}
                {errorMessage && (
                    <div className="add-item-alert-box">
                        <AlertCircle size={15} />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* PAINEL INFERIOR: QUANTIDADE & PREVIEW DE VALORES */}
                <div className="add-item-selection-tray">
                    <div className="add-item-bottom-calc">
                        <div className="add-item-qty-selector">
                            <span className="add-item-qty-label">QTD</span>
                            <div className="add-item-qty-btns">
                                <button
                                    type="button"
                                    className="add-item-qty-btn"
                                    disabled={quantity <= 1}
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                >
                                    <Minus size={13} />
                                </button>
                                <span className="add-item-qty-val">{quantity}</span>
                                <button
                                    type="button"
                                    className="add-item-qty-btn"
                                    onClick={() => setQuantity(q => q + 1)}
                                >
                                    <Plus size={13} />
                                </button>
                            </div>
                        </div>

                        <div className="add-item-subtotal-block">
                            <span className="add-item-calc-sub">
                                {quantity}x {formatCurrency(unitPrice)} = <strong>{formatCurrency(newSubtotal)}</strong>
                            </span>
                            {isCardPayment && newCardFee > 0 && (
                                <span className="add-item-calc-taxa">
                                    Taxa Cartão: +{formatCurrency(newCardFee)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* RODAPÉ COM BOTÕES */}
                <div className="add-item-footer">
                    <button
                        type="button"
                        className="receipt-btn-action-outline cancel"
                        onClick={handleClose}
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        className="receipt-btn-advance"
                        disabled={submitting || !!validationMessage || !targetProduct}
                        onClick={handleConfirm}
                    >
                        {submitting ? (
                            <span>Salvando...</span>
                        ) : (
                            <>
                                <Check size={15} />
                                <span>Salvar Alterações ({formatCurrency(newTotal)})</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
