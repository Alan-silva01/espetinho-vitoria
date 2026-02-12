import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Share2, Minus, Plus, Check } from 'lucide-react'
import { useProduct } from '../../hooks/useProducts'
import { useCart } from '../../hooks/useCart'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import Loading from '../../components/ui/Loading'
import './ProductPage.css'

export default function ProductPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { product, loading } = useProduct(id)
    const { addItem } = useCart()
    const [qty, setQty] = useState(1)
    const [notes, setNotes] = useState('')
    const [selectedVariation, setSelectedVariation] = useState(null)
    const [selectedOptions, setSelectedOptions] = useState({})

    // Initialize defaults from product customization data
    useEffect(() => {
        if (!product?.opcoes_personalizacao) return
        const defaults = {}
        product.opcoes_personalizacao.forEach(group => {
            if (group.padrao) {
                defaults[group.grupo] = group.padrao
            } else if (group.tipo === 'checkbox') {
                defaults[group.grupo] = []
            } else {
                defaults[group.grupo] = ''
            }
        })
        setSelectedOptions(defaults)
    }, [product])

    const totalPrice = useMemo(() => {
        const basePrice = selectedVariation?.preco || product?.preco || 0
        return basePrice * qty
    }, [product, selectedVariation, qty])

    if (loading) return <Loading fullScreen />
    if (!product) return <div className="page-padding" style={{ paddingTop: 80 }}>Produto não encontrado</div>

    const customizations = product.opcoes_personalizacao || []

    function handleOptionToggle(groupName, option, tipo) {
        setSelectedOptions(prev => {
            const current = prev[groupName] || (tipo === 'radio' ? '' : [])

            if (tipo === 'radio') {
                return { ...prev, [groupName]: current === option ? '' : option }
            }

            // checkbox
            const arr = Array.isArray(current) ? current : []
            if (arr.includes(option)) {
                return { ...prev, [groupName]: arr.filter(o => o !== option) }
            } else {
                return { ...prev, [groupName]: [...arr, option] }
            }
        })
    }

    function isOptionSelected(groupName, option, tipo) {
        const current = selectedOptions[groupName]
        if (tipo === 'radio') return current === option
        return Array.isArray(current) && current.includes(option)
    }

    function handleAdd() {
        // Build options summary for display
        const optionsSummary = Object.entries(selectedOptions)
            .filter(([, val]) => (Array.isArray(val) ? val.length > 0 : val))
            .map(([grupo, val]) => `${grupo}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join(' | ')

        addItem({
            produto_id: product.id,
            variacao_id: selectedVariation?.id,
            nome: product.nome + (selectedVariation ? ` - ${selectedVariation.nome}` : ''),
            preco: selectedVariation?.preco || product.preco,
            imagem_url: product.imagem_url,
            quantidade: qty,
            observacoes: [optionsSummary, notes].filter(Boolean).join(' — '),
            personalizacao: selectedOptions,
            eh_upsell: false,
        })
        navigate('/carrinho')
    }

    return (
        <div className="product-page">
            {/* Hero Image */}
            <header className="product-hero">
                <img
                    src={getImageUrl(product.imagem_url) || 'https://via.placeholder.com/600x400?text=🍖'}
                    alt={product.nome}
                    className="product-hero__img"
                />
                <div className="product-hero__overlay" />
                <div className="product-hero__gradient" />
                {/* Top Nav */}
                <div className="product-hero__nav">
                    <button className="product-hero__btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="product-hero__actions">
                        <button className="product-hero__btn"><Heart size={20} /></button>
                        <button className="product-hero__btn"><Share2 size={20} /></button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="product-content">
                {/* Header Info */}
                <div className="product-info">
                    <h1 className="product-info__name">{product.nome}</h1>
                    <div className="product-info__tags">
                        <span className="product-info__tag product-info__tag--highlight">Mais Vendido</span>
                        <div className="product-info__rating">
                            <span>⭐</span>
                            <span>4.8 (120+)</span>
                        </div>
                    </div>
                    <p className="product-info__desc">{product.descricao}</p>
                    <div className="product-info__price">{formatCurrency(product.preco)}</div>
                </div>

                <div className="product-divider" />

                {/* Variations */}
                {product.variacoes_produto?.length > 0 && (
                    <section className="product-section">
                        <div className="product-section__header">
                            <h3>Variações</h3>
                            <span className="product-section__badge">Escolha 1</span>
                        </div>
                        <div className="product-options">
                            {product.variacoes_produto.map(v => (
                                <label key={v.id} className={`product-option ${selectedVariation?.id === v.id ? 'product-option--selected' : ''}`}>
                                    <div className="product-option__left">
                                        <input
                                            type="radio"
                                            name="variacao"
                                            className="product-option__radio"
                                            checked={selectedVariation?.id === v.id}
                                            onChange={() => setSelectedVariation(v)}
                                        />
                                        <span className="product-option__label">{v.nome}</span>
                                    </div>
                                    {v.preco !== product.preco && (
                                        <span className="product-option__price">{formatCurrency(v.preco)}</span>
                                    )}
                                </label>
                            ))}
                        </div>
                    </section>
                )}

                {/* Customization Options */}
                {customizations.map((group, gIdx) => (
                    <section key={gIdx} className="product-section">
                        <div className="product-section__header">
                            <h3>{group.grupo}</h3>
                            <span className="product-section__badge">
                                {group.tipo === 'radio' ? 'Escolha 1' : 'Incluso'}
                            </span>
                        </div>
                        <div className="product-chips">
                            {group.opcoes.map((opt, oIdx) => {
                                const selected = isOptionSelected(group.grupo, opt, group.tipo)
                                return (
                                    <button
                                        key={oIdx}
                                        className={`product-chip ${selected ? 'product-chip--selected' : ''}`}
                                        onClick={() => handleOptionToggle(group.grupo, opt, group.tipo)}
                                    >
                                        {selected && <Check size={12} className="product-chip__check" />}
                                        <span>{opt}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                ))}

                {/* Observations */}
                <section className="product-section">
                    <h3>Alguma observação?</h3>
                    <textarea
                        className="product-notes"
                        placeholder="Ex: Tirar a cebola, caprichar no sal..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                    />
                </section>
            </main>

            {/* Sticky Footer */}
            <div className="product-footer">
                <div className="product-footer__qty">
                    <button
                        className="product-footer__qty-btn"
                        onClick={() => setQty(Math.max(1, qty - 1))}
                    >
                        <Minus size={16} />
                    </button>
                    <span className="product-footer__qty-value">{qty}</span>
                    <button
                        className="product-footer__qty-btn product-footer__qty-btn--plus"
                        onClick={() => setQty(qty + 1)}
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <button className="product-footer__add" onClick={handleAdd}>
                    <span>Adicionar</span>
                    <div className="product-footer__add-total">
                        <span className="product-footer__add-label">Total</span>
                        <span>{formatCurrency(totalPrice)}</span>
                    </div>
                </button>
            </div>
        </div>
    )
}
