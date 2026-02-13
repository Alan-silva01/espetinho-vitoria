import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Flame, ShoppingCart, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCart } from '../../hooks/useCart'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import Loading from '../../components/ui/Loading'
import './FavoritesPage.css'

export default function FavoritesPage() {
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { addItem } = useCart()
    const [topProducts, setTopProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchTopFavorites() {
            setLoading(true)
            try {
                // Fetch counts per product_id from 'curtidas'
                const { data: counts, error: countErr } = await supabase
                    .from('curtidas')
                    .select('produto_id')

                if (countErr) throw countErr

                // Aggregate and sort
                const tally = {}
                counts.forEach(c => tally[c.produto_id] = (tally[c.produto_id] || 0) + 1)

                const sortedIds = Object.entries(tally)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([id]) => id)

                if (sortedIds.length > 0) {
                    // Fetch full product details for these top 5
                    const { data: pros, error: proErr } = await supabase
                        .from('produtos')
                        .select('*, categorias(nome)')
                        .in('id', sortedIds)

                    if (proErr) throw proErr

                    // Maintain the sort order
                    const finalPros = sortedIds.map(id => pros.find(p => p.id === id)).filter(Boolean)
                    setTopProducts(finalPros)
                }
            } catch (err) {
                console.error('Erro ao buscar favoritos:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchTopFavorites()
    }, [])

    if (loading) return <Loading fullScreen text="Buscando os queridinhos..." />

    return (
        <div className="favorites-page animate-fade-in">
            <header className="favorites-header">
                <button className="favorites-header__back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={22} />
                </button>
                <div className="favorites-header__title">
                    <h1>Mais Curtidos</h1>
                    <p>O top 5 da galera 🏆</p>
                </div>
                <div style={{ width: 44 }} />
            </header>

            <div className="favorites-content">
                {topProducts.length === 0 ? (
                    <div className="empty-favorites">
                        <div className="empty-icon">
                            <Heart size={48} strokeWidth={1.5} />
                        </div>
                        <h2>Nenhum favorito ainda</h2>
                        <p>Os produtos mais curtidos aparecerão aqui!</p>
                        <button className="btn btn-primary" onClick={() => navigate('/')}>
                            Ver Cardápio
                        </button>
                    </div>
                ) : (
                    <div className="top-favorites-list">
                        {topProducts.map((product, index) => (
                            <div
                                key={product.id}
                                className="top-favorite-item"
                                onClick={() => navigate(customerCode ? `/${customerCode}/produto/${product.id}` : `/produto/${product.id}`)}
                            >
                                <div className="top-favorite-rank">#{index + 1}</div>
                                <div className="top-favorite-image">
                                    <img src={getImageUrl(product.imagem_url)} alt={product.nome} />
                                </div>
                                <div className="top-favorite-info">
                                    <h3>{product.nome}</h3>
                                    <span className="category-tag">{product.categorias?.nome}</span>
                                    <p className="price">{formatCurrency(product.preco)}</p>
                                </div>
                                <button
                                    className="top-favorite-add"
                                    onClick={(e) => {
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
                                    <Plus size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Hint for users to keep liking */}
            {topProducts.length > 0 && (
                <div className="favorites-footer-hint">
                    <Heart size={14} fill="#C41E2E" color="#C41E2E" />
                    <span>Continue curtindo para mudar o ranking!</span>
                </div>
            )}
        </div>
    )
}
