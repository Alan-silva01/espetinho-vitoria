import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Share2, Minus, Plus, Check } from 'lucide-react'
import { useProduct } from '../../hooks/useProducts'
import { useCart } from '../../hooks/useCart'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import { optimizeUrl } from '../../lib/cloudinary'
import Loading from '../../components/ui/Loading'
import './ProductPage.css'

// Helper: normalize option to always get the name string
const optName = (opt) => (typeof opt === 'string' ? opt : opt.nome)
const optPreco = (opt) => (typeof opt === 'string' ? 0 : Number(opt.preco) || 0)
const optImg = (opt) => (typeof opt === 'string' ? null : opt.imagem_url || null)

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

    // Calculate extras cost from selected add-on options
    const extrasTotal = useMemo(() => {
        if (!product?.opcoes_personalizacao) return 0
        let total = 0
        product.opcoes_personalizacao.forEach(group => {
            const selected = selectedOptions[group.grupo]
            group.opcoes.forEach(opt => {
                const name = optName(opt)
                const price = optPreco(opt)
                if (price <= 0) return
                if (group.tipo === 'radio' && selected === name) {
                    total += price
                } else if (Array.isArray(selected) && selected.includes(name)) {
                    total += price
                }
            })
        })
        return total
    }, [product, selectedOptions])

    const totalPrice = useMemo(() => {
        const basePrice = selectedVariation?.preco || product?.preco || 0
        return (basePrice + extrasTotal) * qty
    }, [product, selectedVariation, qty, extrasTotal])

    if (loading) return <Loading fullScreen />
    if (!product) return <div className="page-padding" style={{ paddingTop: 80 }}>Produto não encontrado</div>

    const customizations = product.opcoes_personalizacao || []

    function handleOptionToggle(groupName, optionName, tipo) {
        setSelectedOptions(prev => {
            const current = prev[groupName] || (tipo === 'radio' ? '' : [])

            if (tipo === 'radio') {
                return { ...prev, [groupName]: current === optionName ? '' : optionName }
            }

            // checkbox
            const arr = Array.isArray(current) ? current : []
            if (arr.includes(optionName)) {
                return { ...prev, [groupName]: arr.filter(o => o !== optionName) }
            } else {
                return { ...prev, [groupName]: [...arr, optionName] }
            }
        })
    }

    function isOptionSelected(groupName, optionName, tipo) {
        const current = selectedOptions[groupName]
        if (tipo === 'radio') return current === optionName
        return Array.isArray(current) && current.includes(optionName)
    }

    // Check if a group has any paid options
    function groupHasPaidOptions(group) {
        return group.opcoes.some(opt => optPreco(opt) > 0)
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
            preco: (selectedVariation?.preco || product.preco) + extrasTotal,
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
                {customizations.map((group, gIdx) => {
                    const hasPaid = groupHasPaidOptions(group)
                    const badgeText = hasPaid ? 'Adicional' : (group.tipo === 'radio' ? 'Escolha 1' : 'Incluso')

                    return (
                        <section key={gIdx} className="product-section">
                            <div className="product-section__header">
                                <h3>{group.grupo}</h3>
                                <span className={`product-section__badge ${hasPaid ? 'product-section__badge--paid' : ''}`}>
                                    {badgeText}
                                </span>
                            </div>
                            <div className="product-addons-list">
                                {group.opcoes.map((opt, oIdx) => {
                                    const name = optName(opt)
                                    const price = optPreco(opt)
                                    const img = optImg(opt)
                                    const selected = isOptionSelected(group.grupo, name, group.tipo)
                                    return (
                                        <button
                                            key={oIdx}
                                            className={`product-addon-item ${selected ? 'product-addon-item--selected' : ''}`}
                                            onClick={() => handleOptionToggle(group.grupo, name, group.tipo)}
                                        >
                                            <div className="product-addon-item__left">
                                                {img ? (
                                                    <img
                                                        src={optimizeUrl(getImageUrl(img), { width: 100, height: 100 })}
                                                        alt={name}
                                                        className="product-addon-item__img"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="product-addon-item__img-placeholder">
                                                        <span>{name.charAt(0)}</span>
                                                    </div>
                                                )}
                                                <div className="product-addon-item__info">
                                                    <span className="product-addon-item__name">{name}</span>
                                                    {price > 0 && (
                                                        <span className="product-addon-item__price">+{formatCurrency(price)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`product-addon-item__check ${selected ? 'product-addon-item__check--active' : ''}`}>
                                                {selected && <Check size={14} />}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>
                    )
                })}

                {/* Observations */}
                <section className="product-section">
                    <h3>Alguma observação?</h3>
                    <textarea
                        className="product-notes"
                        placeholder={product.nome.toLowerCase().includes('açaí')
                            ? "Ex: Acompanhamentos separados, enviar colher..."
                            : "Ex: Tirar a cebola, caprichar no sal..."
                        }
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
