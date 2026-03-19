import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Bell, Flame, IceCream, GlassWater, Soup, Plus, Heart } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useCart } from '../../hooks/useCart'
import { useStore } from '../../hooks/useStore'
import { useCustomer } from '../../context/CustomerContext'
import { useFavorites } from '../../hooks/useFavorites'
import { formatCurrency, getImageUrl, normalizeString } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import Loading from '../../components/ui/Loading'
import PromoMarquee from '../../components/customer/PromoMarquee'
import OptimizedImage from '../../components/ui/OptimizedImage'
import StockWarningModal from '../../components/customer/StockWarningModal'
import './HomePage.css'

/* session ID logic moved to useFavorites.js */

export default function HomePage() {
    const navigate = useNavigate()
    const { products, categories, loading } = useProducts()
    const { customerCode } = useParams()

    // Detection is now globally handled in CustomerLayout.jsx!
    const { addItem, items: cartItems } = useCart()
    const { isOpen, config } = useStore()
    const { liked, toggleLike, animatingHearts } = useFavorites()
    const [activeCategory, setActiveCategoryState] = useState(() => sessionStorage.getItem('espetinho_home_category') || null)
    const [search, setSearchState] = useState(() => sessionStorage.getItem('espetinho_home_search') || '')
    const [promoDestaque, setPromoDestaque] = useState(null)

    const setActiveCategory = (categoryId) => {
        if (categoryId) {
            sessionStorage.setItem('espetinho_home_category', categoryId)
        } else {
            sessionStorage.removeItem('espetinho_home_category')
        }
        setActiveCategoryState(categoryId)
    }

    const setSearch = (value) => {
        sessionStorage.setItem('espetinho_home_search', value)
        setSearchState(value)
    }
    const [stockWarning, setStockWarning] = useState({ open: false, product: '', qty: 0 })

    // Load featured promo
    const fetchPromoDestaque = async () => {
        const { data } = await supabase
            .from('promocoes')
            .select('*')
            .eq('ativa', true)
            .eq('destaque', true)
            .maybeSingle()
        setPromoDestaque(data)
    }

    useEffect(() => {
        fetchPromoDestaque()

        const channel = supabase
            .channel('promo-destaque-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'promocoes' }, () => {
                fetchPromoDestaque()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const categoryIcons = {
        'Espetinhos': Flame,
        'Açaí': IceCream,
        'Bebidas': GlassWater,
        'Caldos': Soup,
    }

    const filteredProducts = products.filter(p => {
        const matchCat = !activeCategory || p.categoria_id === activeCategory
        const normalizedSearch = normalizeString(search)
        const normalizedName = normalizeString(p.nome)
        const matchSearch = !search || normalizedName.includes(normalizedSearch)
        return matchCat && matchSearch
    })

    const handleLike = useCallback((e, productId) => {
        e.stopPropagation()
        toggleLike(productId)
    }, [toggleLike])

    // Helper: find the same default variation used in ProductPage.jsx
    const getDefaultVariation = (product) => {
        if (!product.variacoes_produto || product.variacoes_produto.length === 0) return null

        if (product.nome?.toLowerCase().includes('caldo')) {
            return product.variacoes_produto.find(v => v.nome === '500ml') ||
                product.variacoes_produto.find(v => v.nome === '300ml') ||
                product.variacoes_produto[0]
        }

        if (product.categoria?.nome === 'Espetinhos' ||
            product.nome?.toLowerCase().includes('espetinho') ||
            product.nome?.toLowerCase().includes('medalhão') ||
            product.nome?.toLowerCase().includes('carne')) {
            return product.variacoes_produto.find(v => v.nome.toLowerCase().includes('completo')) ||
                product.variacoes_produto[0]
        }

        // Default: find 300ml (like Açaí)
        return product.variacoes_produto.find(v => v.nome === '300ml') ||
            product.variacoes_produto[0]
    }

    if (loading) return <Loading fullScreen text="Carregando cardápio..." />

    return (
        <div className="home-page animate-fade-in">
            {/* Header */}
            <header className="home-header">
                <div className="home-header__left">
                    <div className="home-header__logo">
                        <img src="/logo.png" alt="Logo" className="home-header__logo-img" />
                    </div>
                    <div>
                        <p className="home-header__welcome">Bem-vindo ao</p>
                        <h1 className="home-header__title">Espetinho Vitória</h1>
                    </div>
                </div>
                <button className="home-header__bell">
                    <Bell size={22} />
                    <span className="home-header__bell-dot" />
                </button>
            </header>

            {/* Promo Marquee */}
            <PromoMarquee />

            {/* Search */}
            <div className="home-search">
                <div className="home-search__wrapper">
                    <Search size={18} className="home-search__icon" />
                    <input
                        type="text"
                        placeholder="O que vamos comer hoje?"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="home-search__input"
                    />
                </div>
            </div>

            {/* Category Tabs */}
            <div className="home-categories hide-scrollbar">
                <button
                    className={`home-category-pill ${!activeCategory ? 'home-category-pill--active' : ''}`}
                    onClick={() => setActiveCategory(null)}
                >
                    <Flame size={14} />
                    <span>Todos</span>
                </button>
                {categories.map(cat => {
                    const Icon = categoryIcons[cat.nome] || Flame
                    return (
                        <button
                            key={cat.id}
                            className={`home-category-pill ${activeCategory === cat.id ? 'home-category-pill--active' : ''}`}
                            onClick={() => setActiveCategory(cat.id)}
                        >
                            <Icon size={14} />
                            <span>{cat.nome}</span>
                        </button>
                    )
                })}
            </div>

            {/* Section Title */}
            <div className="home-section-title">
                <h2>Destaques</h2>
                <button
                    className="home-section-title__link"
                    onClick={() => setActiveCategory(null)}
                >
                    Ver tudo
                </button>
            </div>

            {/* Products Grid */}
            <div className="home-grid">
                {filteredProducts
                    .map((product, index) => {
                        const isEsgotado = !product.disponivel || (product.controlar_estoque && product.quantidade_disponivel <= 0)

                        return (
                            <div
                                key={product.id}
                                className={`product-card ${isEsgotado ? 'product-card--esgotado' : ''}`}
                                onClick={() => {
                                    if (isEsgotado) return
                                    navigate(customerCode ? `/${customerCode}/produto/${product.id}` : `/produto/${product.id}`)
                                }}
                            >
                                <div className="product-card__image-wrapper">
                                    <OptimizedImage
                                        src={getImageUrl(product.imagem_url) || 'https://via.placeholder.com/300x300?text=🍖'}
                                        alt={product.nome}
                                        className="product-card__image"
                                        width={300}
                                        height={300}
                                        priority={index < 4}
                                    />
                                    {isEsgotado && (
                                        <div className="product-card__out-label">ESGOTADO</div>
                                    )}
                                    <button
                                        className={`product-card__fav ${liked[product.id] ? 'product-card__fav--liked' : ''}`}
                                        onClick={e => handleLike(e, product.id)}
                                    >
                                        <Heart
                                            size={14}
                                            fill={liked[product.id] ? '#C41E2E' : 'none'}
                                            color={liked[product.id] ? '#C41E2E' : '#374151'}
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
                                </div>
                                <h3 className="product-card__name">
                                    {product.nome.replace(/\s*\(.*?\)\s*/g, ' ').trim()}
                                </h3>
                                <p className="product-card__desc">
                                    {product.descricao || product.categorias?.nome || ''}
                                </p>
                                <div className="product-card__footer">
                                    <div className="product-card__price-group">
                                        {(() => {
                                            const defaultVar = getDefaultVariation(product)
                                            const isAcai = product.categoria?.nome === 'Açaí' || product.nome?.toLowerCase().includes('açaí')
                                            const displayPrice = defaultVar ? defaultVar.preco : product.preco

                                            return (
                                                <>
                                                    {isAcai && defaultVar && (
                                                        <span className="product-card__variation-label">
                                                            {defaultVar.nome}
                                                        </span>
                                                    )}
                                                    <span className="product-card__price">
                                                        {formatCurrency(displayPrice)}
                                                    </span>
                                                </>
                                            )
                                        })()}
                                    </div>
                                    <button
                                        className="product-card__add"
                                        disabled={isEsgotado}
                                        onClick={e => {
                                            e.stopPropagation()
                                            if (isEsgotado) return

                                            // Check if product has variations or customizations
                                            const hasOptions = (product.variacoes_produto?.length > 0) || (product.opcoes_personalizacao?.length > 0)

                                            if (hasOptions) {
                                                navigate(customerCode ? `/${customerCode}/produto/${product.id}` : `/produto/${product.id}`)
                                                return
                                            }

                                            const inCart = cartItems.find(i => i.produto_id === product.id && !i.variacao_id)
                                            const currentQty = inCart ? inCart.quantidade : 0

                                            if (product.controlar_estoque && (currentQty + 1) > product.quantidade_disponivel) {
                                                setStockWarning({
                                                    open: true,
                                                    product: product.nome,
                                                    qty: product.quantidade_disponivel
                                                })
                                                return
                                            }

                                            // --- Fly-to-Cart animation ---
                                            const btn = e.currentTarget
                                            const rect = btn.getBoundingClientRect()
                                            const cart = document.querySelector('.bottom-nav__cart-btn')
                                            if (cart) {
                                                const cartRect = cart.getBoundingClientRect()
                                                const fly = document.createElement('div')
                                                fly.className = 'fly-to-cart'
                                                // fly.textContent = '🍖' // Removed for pure CSS shape
                                                fly.style.left = `${rect.left + rect.width / 2}px`
                                                fly.style.top = `${rect.top + rect.height / 2}px`
                                                fly.style.setProperty('--dx', `${cartRect.left + cartRect.width / 2 - (rect.left + rect.width / 2)}px`)
                                                fly.style.setProperty('--dy', `${cartRect.top + cartRect.height / 2 - (rect.top + rect.height / 2)}px`)
                                                document.body.appendChild(fly)
                                                fly.addEventListener('animationend', () => {
                                                    fly.remove()
                                                    // Bounce the cart button
                                                    cart.classList.add('cart-bounce')
                                                    setTimeout(() => cart.classList.remove('cart-bounce'), 400)
                                                })
                                            }

                                            addItem({
                                                produto_id: product.id,
                                                nome: product.nome,
                                                preco: product.preco,
                                                imagem_url: product.imagem_url,
                                                eh_upsell: false,
                                            })
                                        }}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
            </div>

            {/* Promo Banner (Oferta do Dia) */}
            {!search && promoDestaque && (
                <div className="home-promo" style={{ background: promoDestaque.cor_fundo }}>
                    <div className="home-promo__content">
                        <span className="home-promo__tag" style={{ color: promoDestaque.cor_texto }}>Oferta do dia</span>
                        <h3 className="home-promo__title" style={{ color: promoDestaque.cor_texto }}>{promoDestaque.titulo}</h3>
                        <p className="home-promo__desc" style={{ color: promoDestaque.cor_texto }}>{promoDestaque.descricao}</p>
                        <button
                            className="home-promo__btn"
                            style={{ background: promoDestaque.cor_texto, color: promoDestaque.cor_fundo }}
                            onClick={(e) => {
                                const desc = promoDestaque.itens?.length > 0
                                    ? `Inclui: ${promoDestaque.itens.join(', ')}`
                                    : promoDestaque.descricao

                                addItem({
                                    produto_id: `promo-${promoDestaque.id}`,
                                    nome: `Banner: ${promoDestaque.titulo}`,
                                    preco: promoDestaque.preco_promocional || 0,
                                    imagem_url: promoDestaque.imagem_url || '',
                                    eh_upsell: false,
                                    descricao: desc,
                                    isCombo: true
                                })

                                // --- Fly-to-Cart animation for Combo ---
                                const btn = e.currentTarget
                                const rect = btn.getBoundingClientRect()
                                const cart = document.querySelector('.bottom-nav__cart-btn')
                                if (cart) {
                                    const cartRect = cart.getBoundingClientRect()
                                    const fly = document.createElement('div')
                                    fly.className = 'fly-to-cart'
                                    // fly.textContent = '🎁' // Removed for pure CSS shape
                                    fly.style.left = `${rect.left + rect.width / 2}px`
                                    fly.style.top = `${rect.top + rect.height / 2}px`
                                    fly.style.setProperty('--dx', `${cartRect.left + cartRect.width / 2 - (rect.left + rect.width / 2)}px`)
                                    fly.style.setProperty('--dy', `${cartRect.top + cartRect.height / 2 - (rect.top + rect.height / 2)}px`)
                                    document.body.appendChild(fly)
                                    fly.addEventListener('animationend', () => {
                                        fly.remove()
                                        cart.classList.add('cart-bounce')
                                        setTimeout(() => cart.classList.remove('cart-bounce'), 400)
                                    })
                                }
                            }}
                        >
                            Peça agora
                        </button>
                    </div>
                </div>
            )}

            {/* Stock Warning Modal */}
            <StockWarningModal
                isOpen={stockWarning.open}
                onClose={() => setStockWarning(prev => ({ ...prev, open: false }))}
                productName={stockWarning.product}
                availableQty={stockWarning.qty}
            />
        </div>
    )
}
