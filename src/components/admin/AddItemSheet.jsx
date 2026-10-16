import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Plus, Minus, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useInventory } from '../../hooks/useInventory'
import { formatCurrency, getSmartItemName } from '../../lib/utils'
import './AddItemSheet.css'

const optName = (opt) => (typeof opt === 'string' ? opt : opt.nome || opt.name || '')
const optPreco = (opt) => {
    if (typeof opt === 'string') return 0
    const val = opt.preco !== undefined ? opt.preco : opt.price
    return Number(val) || 0
}

export default function AddItemSheet({ isOpen, onClose, order, onConfirmItem }) {
    const { products, loading: loadingProducts } = useProducts()
    const { inventory } = useInventory()
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [selectedVariation, setSelectedVariation] = useState(null)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [quantity, setQuantity] = useState(1)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    // Reset ao fechar
    const handleClose = () => {
        setSearchTerm('')
        setSelectedProduct(null)
        setSelectedVariation(null)
        setSelectedOptions({})
        setQuantity(1)
        setNotes('')
        setErrorMessage('')
        onClose()
    }

    // Mapa de estoque diário
    const stockMap = useMemo(() => {
        const map = {}
        if (inventory && Array.isArray(inventory)) {
            inventory.forEach(inv => {
                map[inv.produto_id] = inv
            })
        }
        return map
    }, [inventory])

    // Normalização para pesquisa sem acento
    const normalizeText = (str) => {
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
    }

    // Filtro de produtos (oculta esgotados)
    const filteredProducts = useMemo(() => {
        if (!products) return []
        const term = normalizeText(searchTerm)
        return products.filter(p => {
            if (p.disponivel === false) return false

            // Se o produto estiver esgotado no estoque diário, não exibe
            const stock = stockMap[p.id]
            if (stock && (stock.esgotado || stock.qtd_atual <= 0)) return false

            // Se tem controle de estoque no produto e está zerado
            if (p.controlar_estoque && (p.quantidade_disponivel || 0) <= 0) return false

            if (!term) return true
            const prodName = normalizeText(p.nome)
            const catName = normalizeText(p.categorias?.nome)
            return prodName.includes(term) || catName.includes(term)
        })
    }, [products, searchTerm, stockMap])

    // Validador de disponibilidade da opção (Arroz, Frutas do Açaí, Adicionais, Sabores de Refri)
    const checkOptionAvailable = (opt, groupName) => {
        if (!opt) return false

        // 1. Checagem direta da flag disponivel no objeto da opção
        if (typeof opt === 'object' && opt.disponivel === false) {
            return false
        }

        // 2. Checagem de quantidade específica no objeto da opção (ex: arroz com quantidade: 0)
        if (typeof opt === 'object' && opt.quantidade !== undefined && opt.quantidade !== null && opt.quantidade !== '') {
            if (Number(opt.quantidade) <= 0) return false
        }

        const rawName = typeof opt === 'string' ? opt : (opt.nome || opt.name)
        if (!rawName) return true
        const nameStr = rawName.toLowerCase()

        // 3. Regra global para Açaí (se uma fruta ou adicional está desabilitada em qualquer açaí do cardápio)
        const catName = selectedProduct?.categorias?.nome || selectedProduct?.categoria?.nome
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
                                if (match.quantidade !== undefined && match.quantidade !== null && Number(match.quantidade) <= 0) {
                                    return false
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Regra para Arroz (se o arroz estiver zerado ou desativado em qualquer espetinho)
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
                                if (match.quantidade !== undefined && match.quantidade !== null && Number(match.quantidade) <= 0) {
                                    return false
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. Regra para produtos que existem como item independente no catálogo (ex: refrigerantes, adicionais cadastrados como produtos)
        if (products?.length > 0) {
            const matchingProd = products.find(p => p?.nome && String(p.nome).toLowerCase() === nameStr && p.id !== selectedProduct?.id)
            if (matchingProd) {
                if (matchingProd.disponivel === false) return false
                if (matchingProd.controlar_estoque && (matchingProd.quantidade_disponivel || 0) <= 0) return false
            }
        }

        return true
    }
    useEffect(() => {
        if (!selectedProduct) {
            setSelectedOptions({})
            setSelectedVariation(null)
            return
        }

        // 1. Variação padrão
        if (selectedProduct.variacoes_produto?.length > 0) {
            const isEspetinho = (selectedProduct.nome || '').toLowerCase().includes('espetinho') ||
                                (selectedProduct.categorias?.nome || '').toLowerCase().includes('espetinho')
            if (isEspetinho) {
                const vCompleto = selectedProduct.variacoes_produto.find(v => v.nome.toLowerCase().includes('completo'))
                setSelectedVariation(vCompleto || selectedProduct.variacoes_produto[0])
            } else {
                setSelectedVariation(selectedProduct.variacoes_produto[0])
            }
        } else {
            setSelectedVariation(null)
        }

        // 2. Opções de personalização padrão
        const defaults = {}
        const isEspetinho = (selectedProduct.nome || '').toLowerCase().includes('espetinho')
        if (selectedProduct.opcoes_personalizacao) {
            selectedProduct.opcoes_personalizacao.forEach(group => {
                const groupLower = (group.grupo || '').toLowerCase()
                const isSingleSelectionGroup = group.tipo === 'radio' ||
                    groupLower.includes('tamanho') ||
                    groupLower.includes('tipo') ||
                    group.maximo === 1

                if (group.padrao) {
                    defaults[group.grupo] = isSingleSelectionGroup ? group.padrao : (Array.isArray(group.padrao) ? group.padrao : [group.padrao])
                } else if (isSingleSelectionGroup) {
                    const availableOpts = group.opcoes?.filter(opt => checkOptionAvailable(opt, group.grupo)) || []
                    if (availableOpts.length === 1) {
                        defaults[group.grupo] = optName(availableOpts[0])
                    } else {
                        defaults[group.grupo] = ''
                    }
                } else if (group.tipo === 'checkbox') {
                    const isChoiceGroup = groupLower.includes('escolha') || (group.maximo !== undefined && group.maximo !== null)
                    if (isChoiceGroup) {
                        // Grupos de escolha (ex: "Escolha 2 frutas", "Escolha 3 itens") devem vir desmarcados para o usuário escolher
                        defaults[group.grupo] = []
                    } else if (group.padrao) {
                        defaults[group.grupo] = Array.isArray(group.padrao) ? group.padrao : [group.padrao]
                    } else if (isEspetinho || ['acompanha', 'incluso', 'acompanhamento'].some(kw => groupLower.includes(kw))) {
                        // Apenas acompanhamentos fixos que vêm juntos por padrão
                        const inclusos = group.opcoes
                            .filter(opt => optPreco(opt) === 0 && checkOptionAvailable(opt, group.grupo))
                            .map(opt => optName(opt))
                        defaults[group.grupo] = inclusos
                    } else {
                        defaults[group.grupo] = []
                    }
                }
            })
        }
        setSelectedOptions(defaults)
    }, [selectedProduct])

    // Ajustar opções caso a variação mude (ex: Completo vs Só a Carne)
    useEffect(() => {
        if (!selectedProduct?.opcoes_personalizacao || !selectedVariation) return

        const hasCompleto = selectedProduct.variacoes_produto?.some(v => v.nome.toLowerCase().includes('completo'))
        if (!hasCompleto) return

        const isCompleto = selectedVariation.nome.toLowerCase().includes('completo')
        const inclusionKeywords = ['acompanha', 'incluso', 'acompanhamento', 'complemento']
        const arrozKeywords = ['arroz', 'tipo de arroz']

        const accompGroup = selectedProduct.opcoes_personalizacao.find(g =>
            inclusionKeywords.some(kw => g.grupo.toLowerCase().includes(kw))
        )
        const arrozGroup = selectedProduct.opcoes_personalizacao.find(g =>
            arrozKeywords.some(kw => g.grupo.toLowerCase().includes(kw))
        )

        if (isCompleto) {
            if (accompGroup) {
                const freeOptions = accompGroup.opcoes
                    .filter(opt => optPreco(opt) === 0 && checkOptionAvailable(opt, accompGroup.grupo))
                    .map(opt => optName(opt))
                setSelectedOptions(prev => ({ ...prev, [accompGroup.grupo]: freeOptions }))
            }
        } else {
            // Não completo: zera acompanhamentos e arroz
            setSelectedOptions(prev => {
                const updated = { ...prev }
                if (accompGroup) updated[accompGroup.grupo] = []
                if (arrozGroup) updated[arrozGroup.grupo] = ''
                return updated
            })
        }
    }, [selectedVariation, selectedProduct])

    // Verifica se há grupo único de preço-base (como Tamanho em Refrigerante de 1L ou 2L sem variacoes_produto)
    const hasPriceReplacement = useMemo(() => {
        if (!selectedProduct?.opcoes_personalizacao) return false
        if (selectedProduct.variacoes_produto?.length > 0) return false
        return selectedProduct.opcoes_personalizacao.some(g => {
            const gLower = (g.grupo || '').toLowerCase()
            const isSingle = g.tipo === 'radio' || gLower.includes('tamanho') || gLower.includes('tipo') || g.maximo === 1
            return isSingle && g.opcoes?.some(opt => optPreco(opt) > 0)
        })
    }, [selectedProduct])

    // Cálculo dos adicionais (extras)
    const extrasTotal = useMemo(() => {
        if (!selectedProduct?.opcoes_personalizacao) return 0
        let total = 0
        selectedProduct.opcoes_personalizacao.forEach(group => {
            const groupLower = (group.grupo || '').toLowerCase()
            const isSingle = group.tipo === 'radio' ||
                groupLower.includes('tamanho') ||
                groupLower.includes('tipo') ||
                group.maximo === 1

            // Se esse grupo atua como substituto do preço base (ex: Tamanho), ele entra como preço base, não extra
            if (hasPriceReplacement && isSingle && group.opcoes?.some(opt => optPreco(opt) > 0)) {
                return
            }

            const selected = selectedOptions[group.grupo]
            if (!selected) return

            group.opcoes.forEach(opt => {
                const name = optName(opt)
                const price = optPreco(opt)
                if (price <= 0) return

                if (isSingle && selected === name) {
                    total += price
                } else if (Array.isArray(selected)) {
                    const count = selected.filter(item => item === name).length
                    total += price * count
                }
            })
        })
        return total
    }, [selectedProduct, selectedOptions, hasPriceReplacement])

    // Preço unitário total (base + variação + adicionais)
    const unitPrice = useMemo(() => {
        if (!selectedProduct) return 0
        let basePrice = Number(selectedProduct.preco || 0)

        if (selectedVariation?.preco !== undefined && selectedVariation?.preco !== null) {
            basePrice = Number(selectedVariation.preco)
        } else if (hasPriceReplacement && selectedProduct.opcoes_personalizacao) {
            for (const group of selectedProduct.opcoes_personalizacao) {
                const groupLower = (group.grupo || '').toLowerCase()
                const isSingle = group.tipo === 'radio' || groupLower.includes('tamanho') || groupLower.includes('tipo') || group.maximo === 1
                if (isSingle && group.opcoes?.some(opt => optPreco(opt) > 0)) {
                    const selected = selectedOptions[group.grupo]
                    const selectedOpt = group.opcoes.find(opt => optName(opt) === selected)
                    if (selectedOpt && optPreco(selectedOpt) > 0) {
                        basePrice = optPreco(selectedOpt)
                    }
                    break
                }
            }
        }

        return basePrice + extrasTotal
    }, [selectedProduct, selectedVariation, extrasTotal, hasPriceReplacement, selectedOptions])

    // Cálculo proporcional de taxa de cartão
    const isCardPayment = order?.forma_pagamento?.toLowerCase().includes('cartao')
    const currentSubtotal = Number(order?.subtotal) || 0
    const currentEntrega = Number(order?.taxa_entrega) || 0
    const currentCardFee = Number(order?.taxa_cartao) || 0
    const base = currentSubtotal + currentEntrega
    const taxaPct = isCardPayment && base > 0 ? currentCardFee / base : 0

    const addedSubtotal = unitPrice * quantity
    const addedCardFee = isCardPayment ? addedSubtotal * taxaPct : 0
    const addedTotal = addedSubtotal + addedCardFee

    const invStatus = selectedProduct ? stockMap[selectedProduct.id] : null
    const isOutOfStock = invStatus ? (invStatus.esgotado || invStatus.qtd_atual <= 0) : false
    const maxStock = invStatus && !invStatus.esgotado ? invStatus.qtd_atual : null

    // Handlers para seleção de opções
    const handleToggleCheckboxOption = (group, opt) => {
        const name = optName(opt)
        const groupName = group.grupo
        const maximo = group.maximo

        setSelectedOptions(prev => {
            const cur = Array.isArray(prev[groupName]) ? prev[groupName] : []
            if (cur.includes(name)) {
                return { ...prev, [groupName]: cur.filter(item => item !== name) }
            } else {
                if (maximo && cur.length >= maximo) {
                    // FIFO: substitui o mais antigo se chegou no limite
                    return { ...prev, [groupName]: [...cur.slice(1), name] }
                }
                return { ...prev, [groupName]: [...cur, name] }
            }
        })
    }

    const handleSelectRadioOption = (group, opt) => {
        const name = optName(opt)
        setSelectedOptions(prev => ({
            ...prev,
            [group.grupo]: prev[group.grupo] === name ? '' : name
        }))
    }

    // Validação de requisitos
    const validationMessage = useMemo(() => {
        if (!selectedProduct) return null
        if (isOutOfStock) return 'Produto esgotado no estoque de hoje'

        if (selectedProduct.opcoes_personalizacao) {
            // Verificar grupos "Escolha X"
            for (const group of selectedProduct.opcoes_personalizacao) {
                const groupName = group.grupo?.toLowerCase() || ''
                if (groupName.includes('escolha')) {
                    const match = groupName.match(/escolha\s*(\d+)/i)
                    if (match) {
                        const required = parseInt(match[1])
                        const current = selectedOptions[group.grupo]
                        const count = Array.isArray(current) ? current.length : 0
                        if (count !== required) {
                            const remaining = required - count
                            if (remaining > 0) return `Selecione mais ${remaining} em "${group.grupo}"`
                            return `Selecione ${required} em "${group.grupo}"`
                        }
                    }
                }
            }

            // Exigência de arroz para espetinho Completo
            const isCompleto = selectedVariation?.nome?.toLowerCase().includes('completo')
            if (isCompleto) {
                const arrozGroup = selectedProduct.opcoes_personalizacao.find(g =>
                    ['arroz', 'tipo de arroz'].some(kw => g.grupo.toLowerCase().includes(kw))
                )
                if (arrozGroup) {
                    const sel = selectedOptions[arrozGroup.grupo]
                    if (!sel || (Array.isArray(sel) && sel.length === 0)) {
                        return 'Escolha o tipo de arroz'
                    }
                }
            }
        }
        return null
    }, [selectedProduct, selectedVariation, selectedOptions, isOutOfStock])

    const handleConfirm = async () => {
        if (!selectedProduct) return
        if (validationMessage) {
            setErrorMessage(validationMessage)
            return
        }
        setSubmitting(true)
        setErrorMessage('')
        try {
            const finalDisplayName = getSmartItemName(
                selectedProduct.nome,
                selectedVariation?.nome,
                selectedOptions
            )

            await onConfirmItem({
                produto_id: selectedProduct.id,
                variacao_id: selectedVariation?.id || null,
                quantidade: quantity,
                preco_unitario: unitPrice,
                personalizacao: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
                observacoes: notes.trim() || null,
                nome: finalDisplayName,
                // Full objects for optimistic icon rendering in OrderDetailModal
                _product: selectedProduct,
                _variation: selectedVariation || null,
            })
            handleClose()
        } catch (err) {
            console.error('Erro ao adicionar item:', err)
            setErrorMessage(err.message || 'Erro ao adicionar item ao pedido.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <div className="add-item-overlay" onClick={handleClose}>
            <div className="add-item-modal-exact" onClick={(e) => e.stopPropagation()}>
                {/* TOPO ESCURO ESTILO RECIBO */}
                <div className="add-item-top-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selectedProduct && (
                            <button
                                type="button"
                                className="add-item-back-btn"
                                onClick={() => setSelectedProduct(null)}
                                title="Voltar para a lista"
                            >
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <span className="add-item-top-title">
                            {selectedProduct ? 'PERSONALIZAR ITEM' : 'ADICIONAR ITEM AO CARDÁPIO'}
                        </span>
                    </div>
                    <div className="add-item-top-right">
                        <span className="add-item-top-number">N - {order?.numero_pedido}</span>
                        <button className="add-item-top-close-btn" onClick={handleClose} title="Fechar">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ETAPA 1: LISTA E BUSCA DE PRODUTOS */}
                {!selectedProduct && (
                    <>
                        <div className="add-item-search-container">
                            <div className="add-item-search-box">
                                <Search size={15} className="add-item-search-icon" />
                                <input
                                    type="text"
                                    className="add-item-search-input"
                                    placeholder="Buscar produto por nome ou categoria..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    name="search_cardapio_item"
                                    autoFocus
                                />
                                {searchTerm && (
                                    <button className="add-item-clear-search" onClick={() => setSearchTerm('')}>
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="add-item-table-header">
                            <span>PRODUTO</span>
                            <span>A PARTIR DE</span>
                        </div>

                        <div className="add-item-products-list">
                            {loadingProducts ? (
                                <div className="add-item-empty">Carregando cardápio...</div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="add-item-empty">Nenhum produto encontrado.</div>
                            ) : (
                                filteredProducts.map((p) => {
                                    const stock = stockMap[p.id]
                                    const _pOutOfStock = stock ? (stock.esgotado || stock.qtd_atual <= 0) : false
                                    const displayPrice = p.preco !== undefined ? Number(p.preco) : 0

                                    return (
                                        <div
                                            key={p.id}
                                            className="add-item-row"
                                            onClick={() => {
                                                setErrorMessage('')
                                                setSelectedProduct(p)
                                            }}
                                        >
                                            <div className="add-item-row-left">
                                                <div className="add-item-icon-box">
                                                    {p.imagem_url ? (
                                                        <img src={p.imagem_url} alt={p.nome} className="add-item-product-img" />
                                                    ) : (
                                                        <span className="add-item-icon-fallback">🍢</span>
                                                    )}
                                                </div>
                                                <div className="add-item-details">
                                                    <span className="add-item-title">{p.nome}</span>
                                                    <div className="add-item-sub-meta">
                                                        <span className="add-item-cat">{p.categorias?.nome || 'Geral'}</span>
                                                        {stock && stock.qtd_atual !== undefined && (
                                                            <span className="add-item-stock-tag">Estoque: {stock.qtd_atual}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <span className="add-item-price">{formatCurrency(displayPrice)}</span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </>
                )}

                {/* ETAPA 2: CONFIGURAÇÃO DE VARIAÇÕES E PERSONALIZAÇÃO */}
                {selectedProduct && (
                    <div className="add-item-customizer-scroll">
                        {/* CABEÇALHO DO PRODUTO SELECIONADO */}
                        <div className="add-item-selected-header">
                            <div className="add-item-icon-box" style={{ width: 44, height: 44 }}>
                                {selectedProduct.imagem_url ? (
                                    <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="add-item-product-img" style={{ width: 40, height: 40 }} />
                                ) : (
                                    <span className="add-item-icon-fallback">🍢</span>
                                )}
                            </div>
                            <div>
                                <h4 className="add-item-selected-title">{selectedProduct.nome}</h4>
                                <span className="add-item-selected-cat">{selectedProduct.categorias?.nome}</span>
                            </div>
                        </div>

                        {/* 1. VARIAÇÕES DE PRODUTO (Ex: Tamanho 300ml/500ml ou Completo/Só Carne) */}
                        {selectedProduct.variacoes_produto && selectedProduct.variacoes_produto.length > 0 && (
                            <div className="add-item-group-block">
                                <div className="add-item-group-header">
                                    <span className="add-item-group-title">ESCOLHA O TIPO / TAMANHO</span>
                                    <span className="add-item-group-badge">OBRIGATÓRIO</span>
                                </div>
                                <div className="add-item-options-list">
                                    {selectedProduct.variacoes_produto.map(v => {
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

                        {/* 2. GRUPOS DE PERSONALIZAÇÃO (Acompanhamentos, Sabores, Adicionais, etc.) */}
                        {selectedProduct.opcoes_personalizacao && selectedProduct.opcoes_personalizacao.map((group, gIdx) => {
                            const groupLower = (group.grupo || '').toLowerCase()
                            const isRadio = group.tipo === 'radio' ||
                                groupLower.includes('tamanho') ||
                                groupLower.includes('tipo') ||
                                group.maximo === 1
                            const currentSel = selectedOptions[group.grupo]
                            const productHasCompleto = selectedProduct.variacoes_produto?.some(v => v.nome.toLowerCase().includes('completo'))
                            const isCompleto = selectedVariation?.nome?.toLowerCase().includes('completo')
                            const isAccompaniment = ['acompanha', 'incluso', 'acompanhamento'].some(kw => group.grupo.toLowerCase().includes(kw))
                            const isArroz = ['arroz', 'tipo de arroz'].some(kw => group.grupo.toLowerCase().includes(kw))
                            const isDisabledByVariation = productHasCompleto && selectedVariation && !isCompleto && (isAccompaniment || isArroz)

                            if (isDisabledByVariation) return null

                            return (
                                <div key={gIdx} className="add-item-group-block">
                                    <div className="add-item-group-header">
                                        <span className="add-item-group-title">{group.grupo}</span>
                                        {group.maximo && <span className="add-item-group-badge">MÁX {group.maximo}</span>}
                                    </div>

                                    <div className="add-item-options-list">
                                        {group.opcoes && group.opcoes
                                            .filter(opt => checkOptionAvailable(opt, group.grupo))
                                            .map((opt, oIdx) => {
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
                                placeholder="Ex: Pouco gelo, sem cebola, bem passado..."
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
                {selectedProduct && (
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
                                        disabled={maxStock !== null && quantity >= maxStock}
                                        onClick={() => setQuantity(q => q + 1)}
                                    >
                                        <Plus size={13} />
                                    </button>
                                </div>
                            </div>

                            <div className="add-item-subtotal-block">
                                <span className="add-item-calc-sub">
                                    {quantity}x {formatCurrency(unitPrice)} = <strong>{formatCurrency(addedSubtotal)}</strong>
                                </span>
                                {isCardPayment && addedCardFee > 0 && (
                                    <span className="add-item-calc-taxa">
                                        Taxa Cartão: +{formatCurrency(addedCardFee)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* RODAPÉ COM BOTÕES */}
                <div className="add-item-footer">
                    <button
                        type="button"
                        className="receipt-btn-action-outline cancel"
                        onClick={selectedProduct ? () => setSelectedProduct(null) : handleClose}
                    >
                        {selectedProduct ? 'Voltar' : 'Cancelar'}
                    </button>

                    <button
                        type="button"
                        className="receipt-btn-advance"
                        disabled={!selectedProduct || submitting || isOutOfStock}
                        onClick={handleConfirm}
                    >
                        {submitting ? (
                            <span>Adicionando...</span>
                        ) : (
                            <>
                                <Check size={15} />
                                <span>
                                    {selectedProduct
                                        ? `Confirmar (+${formatCurrency(addedTotal)})`
                                        : 'Selecione um Produto'}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
