import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Share2, Minus, Plus, Check, ShoppingCart } from 'lucide-react'
import { useProduct } from '../../hooks/useProducts'
import { useCart } from '../../hooks/useCart'
import { useFavorites } from '../../hooks/useFavorites'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import { optimizeUrl } from '../../lib/cloudinary'
import Loading from '../../components/ui/Loading'
import OptimizedImage from '../../components/ui/OptimizedImage'
import './ProductPage.css'

// Helper: normalize option to always get the name string
const optName = (opt) => (typeof opt === 'string' ? opt : opt.nome || opt.name)
const optPreco = (opt) => {
    if (typeof opt === 'string') return 0
    // Try both Porto and English keys, and ensure it's a number
    const val = opt.preco !== undefined ? opt.preco : opt.price
    return Number(val) || 0
}
const optImg = (opt) => (typeof opt === 'string' ? null : opt.imagem_url || opt.image_url || null)

export default function ProductPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { product, loading } = useProduct(id)
    const { addItem } = useCart()
    const { liked, toggleLike, animatingHearts } = useFavorites()
    const [qty, setQty] = useState(1)
    const [notes, setNotes] = useState('')
    const [selectedVariation, setSelectedVariation] = useState(null)
    const [selectedOptions, setSelectedOptions] = useState({})

    // Pre-select 300ml variation for Açaí or 500ml for Caldos on load
    useEffect(() => {
        if (product?.variacoes_produto?.length > 0) {
            if (product.nome?.toLowerCase().includes('caldo')) {
                const v300 = product.variacoes_produto.find(v => v.nome === '300ml')
                const v500 = product.variacoes_produto.find(v => v.nome === '500ml')
                if (v500) setSelectedVariation(v500)
                else if (v300) setSelectedVariation(v300)
            } else if (product.categoria?.nome === 'Espetos' || product.nome?.toLowerCase().includes('espetinho') || product.nome?.toLowerCase().includes('medalhão') || product.nome?.toLowerCase().includes('carne')) {
                // Skewers: find "Completo" variation
                const vCompleto = product.variacoes_produto.find(v => v.nome.toLowerCase().includes('completo'))
                if (vCompleto) setSelectedVariation(vCompleto)
                else setSelectedVariation(product.variacoes_produto[0]) // Fallback to first if no "Completo" found
            } else {
                // Default to 300ml for others if exists (like Açaí)
                const v300 = product.variacoes_produto.find(v => v.nome === '300ml')
                if (v300) setSelectedVariation(v300)
            }
        }
    }, [product])

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

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

    function handleOptionToggle(group, optionName) {
        const { grupo: groupName, tipo, maximo } = group
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
                // FIFO behavior: if maximo reached, remove oldest selection
                if (maximo && arr.length >= maximo) {
                    const newArr = [...arr.slice(1), optionName]
                    return { ...prev, [groupName]: newArr }
                }
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
        if (group.grupo?.toLowerCase().includes('pago')) return true
        return group.opcoes.some(opt => optPreco(opt) > 0)
    }

    function handleAdd(e) {
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
            observacoes: notes,
            personalizacao: selectedOptions,
            eh_upsell: false,
        })

        // --- Fly-to-Cart Animation ---
        const btn = e.currentTarget
        const rect = btn.getBoundingClientRect()
        // Try to find the cart icon in the header (ProductPage) or BottomNav (if visible)
        const cart = document.querySelector('.product-hero__cart-btn') || document.querySelector('.bottom-nav__cart-btn')

        if (cart) {
            const cartRect = cart.getBoundingClientRect()
            const fly = document.createElement('div')
            fly.className = 'fly-to-cart'
            fly.style.left = `${rect.left + rect.width / 2}px`
            fly.style.top = `${rect.top + rect.height / 2}px`
            fly.style.setProperty('--dx', `${cartRect.left + cartRect.width / 2 - (rect.left + rect.width / 2)}px`)
            fly.style.setProperty('--dy', `${cartRect.top + cartRect.height / 2 - (rect.top + rect.height / 2)}px`)
            document.body.appendChild(fly)

            fly.addEventListener('animationend', () => {
                fly.remove()
                cart.classList.add('cart-bounce')
                setTimeout(() => cart.classList.remove('cart-bounce'), 400)
                // Navigate after animation
                navigate('/carrinho')
            })
        } else {
            // Fallback if no cart visible
            navigate('/carrinho')
        }
    }

    return (
        <div className="product-page">
            {/* Hero Image */}
            <header className="product-hero">
                <OptimizedImage
                    src={getImageUrl(product.imagem_url) || 'https://via.placeholder.com/600x400?text=🍖'}
                    alt={product.nome}
                    className="product-hero__img"
                    width={600}
                    height={400}
                    priority={true}
                />
                <div className="product-hero__overlay" />
                <div className="product-hero__gradient" />
                {product.quantidade_disponivel === 0 && (
                    <div className="product-hero__out-badge">PRODUTO ESGOTADO</div>
                )}
                {/* Top Nav */}
                <div className="product-hero__nav">
                    <button className="product-hero__btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="product-hero__actions">
                        <button className="product-hero__btn product-hero__cart-btn" onClick={() => navigate('/carrinho')}>
                            <ShoppingCart size={20} />
                        </button>
                        <button
                            className={`product-hero__btn ${liked[product.id] ? 'product-hero__btn--liked' : ''}`}
                            onClick={() => toggleLike(product.id)}
                        >
                            <Heart
                                size={20}
                                fill={liked[product.id] ? '#ef4444' : 'none'}
                                color={liked[product.id] ? '#ef4444' : 'currentColor'}
                            />
                            {/* Heart burst animation */}
                            {animatingHearts[product.id] && (
                                <div className="heart-burst">
                                    {[...Array(6)].map((_, i) => (
                                        <span key={i} className="heart-burst__particle" style={{ '--i': i }}>❤</span>
                                    ))}
                                </div>
                            )}
                        </button>
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
                            {product.variacoes_produto
                                .filter(v => v.disponivel !== false && (v.quantidade_disponivel === undefined || v.quantidade_disponivel > 0))
                                .map(v => (
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
                                        <span className="product-option__price">{formatCurrency(v.preco)}</span>
                                    </label>
                                ))}
                        </div>
                    </section>
                )}

                {/* Customization Options */}
                {customizations.map((group, gIdx) => {
                    // Check if group has any available options
                    const availableOptions = group.opcoes.filter(opt => {
                        const isAvailable = typeof opt === 'string'
                            ? true
                            : (opt.disponivel !== false && (opt.quantidade_disponivel === undefined || opt.quantidade_disponivel > 0))
                        return isAvailable
                    })

                    // Hide group if NO options are available
                    if (availableOptions.length === 0) return null

                    const hasPaid = groupHasPaidOptions(group)
                    const isOptional = group.tipo === 'radio'
                    const badgeText = hasPaid ? 'Adicional' : (isOptional ? 'Escolha 1' : 'Incluso')

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
                                    // Check availability (redundant but safe)
                                    const isAvailable = typeof opt === 'string'
                                        ? true
                                        : (opt.disponivel !== false && (opt.quantidade_disponivel === undefined || opt.quantidade_disponivel > 0))

                                    if (!isAvailable) return null

                                    const selected = isOptionSelected(group.grupo, name, group.tipo)
                                    return (
                                        <button
                                            key={oIdx}
                                            className={`product-addon-item ${selected ? 'product-addon-item--selected' : ''}`}
                                            onClick={() => handleOptionToggle(group, name)}
                                        >
                                            <div className="product-addon-item__left">
                                                {img ? (
                                                    <OptimizedImage
                                                        src={getImageUrl(img)}
                                                        alt={name}
                                                        className="product-addon-item__img"
                                                        width={80}
                                                        height={80}
                                                    />
                                                ) : (
                                                    <div className="product-addon-item__img-placeholder">
                                                        <span>{name.charAt(0)}</span>
                                                    </div>
                                                )}
                                                <div className="product-addon-item__info">
                                                    <span className="product-addon-item__name">{name}</span>
                                                    {(() => {
                                                        if (group.tipo === 'radio') {
                                                            const showTotal = price > 0 || customizations.length === 1 || group.grupo === 'Tamanho'
                                                            if (showTotal) {
                                                                return (
                                                                    <span className="product-addon-item__price">
                                                                        {formatCurrency((product.preco || 0) + price)}
                                                                    </span>
                                                                )
                                                            }
                                                            return null
                                                        }
                                                        return price > 0 && (
                                                            <span className="product-addon-item__price">+{formatCurrency(price)}</span>
                                                        )
                                                    })()}
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
                        placeholder={
                            product.nome.toLowerCase().includes('suco') || product.nome.toLowerCase().includes('refrigerante') || product.categoria_id === 'bebidas'
                                ? "Ex: Sem gelo, pouco açúcar..."
                                : product.nome.toLowerCase().includes('açaí')
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
                <button
                    className="product-footer__add"
                    onClick={handleAdd}
                    disabled={product.quantidade_disponivel === 0}
                    style={product.quantidade_disponivel === 0 ? { background: '#9CA3AF', cursor: 'not-allowed' } : {}}
                >
                    <span>{product.quantidade_disponivel === 0 ? 'Esgotado' : 'Adicionar'}</span>
                    {product.quantidade_disponivel > 0 && (
                        <div className="product-footer__add-total">
                            <span className="product-footer__add-label">Total</span>
                            <span>{formatCurrency(totalPrice)}</span>
                        </div>
                    )}
                </button>
            </div>
        </div>
    )
}
