import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Flame, IceCreamCone, GlassWater, Soup, Plus, Heart } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useCart } from '../../hooks/useCart'
import { useStore } from '../../hooks/useStore'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import Loading from '../../components/ui/Loading'
import PromoMarquee from '../../components/customer/PromoMarquee'
import './HomePage.css'

/* Generate or retrieve a unique session ID for likes */
function getSessionId() {
    let sid = localStorage.getItem('espetinho_session')
    if (!sid) {
        sid = crypto.randomUUID()
        localStorage.setItem('espetinho_session', sid)
    }
    return sid
}

export default function HomePage() {
    const navigate = useNavigate()
    const { products, categories, loading } = useProducts()
    const { addItem } = useCart()
    const { isOpen, config } = useStore()
    const [activeCategory, setActiveCategory] = useState(null)
    const [search, setSearch] = useState('')
    const [liked, setLiked] = useState(() => {
        try { return JSON.parse(localStorage.getItem('espetinho_likes') || '{}') }
        catch { return {} }
    })
    const [animatingHearts, setAnimatingHearts] = useState({})

    const categoryIcons = {
        'Espetos': Flame,
        'Açaí': IceCreamCone,
        'Bebidas': GlassWater,
        'Caldos': Soup,
    }

    const filteredProducts = products.filter(p => {
        const matchCat = !activeCategory || p.categoria_id === activeCategory
        const matchSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
    })

    const handleLike = useCallback(async (e, productId) => {
        e.stopPropagation()
        const sessionId = getSessionId()
        const isLiked = liked[productId]

        // Trigger heart burst animation
        setAnimatingHearts(prev => ({ ...prev, [productId]: true }))
        setTimeout(() => setAnimatingHearts(prev => ({ ...prev, [productId]: false })), 800)

        if (isLiked) {
            // Remove like
            setLiked(prev => {
                const next = { ...prev }
                delete next[productId]
                localStorage.setItem('espetinho_likes', JSON.stringify(next))
                return next
            })
            await supabase.from('curtidas').delete().match({ produto_id: productId, session_id: sessionId })
        } else {
            // Add like
            setLiked(prev => {
                const next = { ...prev, [productId]: true }
                localStorage.setItem('espetinho_likes', JSON.stringify(next))
                return next
            })
            await supabase.from('curtidas').insert({ produto_id: productId, session_id: sessionId })
        }
    }, [liked])

    if (loading) return <Loading fullScreen text="Carregando cardápio..." />

    return (
        <div className="home-page animate-fade-in">
            {/* Header */}
            <header className="home-header">
                <div className="home-header__left">
                    <div className="home-header__logo">
                        <Flame size={20} color="#C41E2E" />
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
                <button className="home-section-title__link">Ver tudo</button>
            </div>

            {/* Products Grid */}
            <div className="home-grid">
                {filteredProducts.map(product => (
                    <div
                        key={product.id}
                        className="product-card"
                        onClick={() => navigate(`/produto/${product.id}`)}
                    >
                        <div className="product-card__image-wrapper">
                            <img
                                src={getImageUrl(product.imagem_url) || 'https://via.placeholder.com/300x300?text=🍖'}
                                alt={product.nome}
                                className="product-card__image"
                            />
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
                        <h3 className="product-card__name">{product.nome}</h3>
                        <p className="product-card__desc">
                            {product.descricao || product.categorias?.nome || ''}
                        </p>
                        <div className="product-card__footer">
                            <span className="product-card__price">{formatCurrency(product.preco)}</span>
                            <button
                                className="product-card__add"
                                onClick={e => {
                                    e.stopPropagation()
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
                ))}
            </div>

            {/* Promo Banner (Oferta do Dia) */}
            {!search && (
                <div className="home-promo">
                    <div className="home-promo__content">
                        <span className="home-promo__tag">Oferta do dia</span>
                        <h3 className="home-promo__title">Combo Casal</h3>
                        <p className="home-promo__desc">2 Espetos + 1 Açaí grande</p>
                        <button className="home-promo__btn">Peça agora</button>
                    </div>
                    <div className="home-promo__circle" />
                </div>
            )}

            {/* Store Closed Overlay */}
            {!isOpen && (
                <div className="store-closed-overlay">
                    <div className="store-closed-card">
                        <span className="store-closed-icon">🌙</span>
                        <h2>Estamos Fechados</h2>
                        <p>Voltamos amanhã! Confira nosso horário de funcionamento.</p>
                        {config?.horario_abertura && (
                            <p className="store-closed-hours">
                                Abrimos às {config.horario_abertura?.slice(0, 5)}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
