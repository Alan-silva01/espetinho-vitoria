import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Minus, Plus, MapPin } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useProducts } from '../../hooks/useProducts'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import './CartPage.css'

export default function CartPage() {
    const navigate = useNavigate()
    const { items, removeItem, updateQuantity, clearCart, subtotal, totalItems } = useCart()
    const { getUpsellProducts, addItem } = useProducts()
    const { addItem: addToCart } = useCart()

    const taxaEntrega = 5.0
    const total = subtotal + taxaEntrega

    if (items.length === 0) {
        return (
            <div className="cart-empty animate-fade-in">
                <span className="cart-empty__icon">🛒</span>
                <h2>Seu carrinho está vazio</h2>
                <p>Adicione itens do cardápio para fazer um pedido delicioso!</p>
                <button className="btn btn-primary btn-md" onClick={() => navigate('/')}>
                    Ver Cardápio
                </button>
            </div>
        )
    }

    return (
        <div className="cart-page animate-fade-in">
            {/* Header */}
            <header className="cart-header">
                <button className="cart-header__back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={22} />
                </button>
                <h1 className="cart-header__title">Seu Carrinho</h1>
                <button className="cart-header__clear" onClick={clearCart}>
                    Limpar
                </button>
            </header>

            <div className="cart-scroll hide-scrollbar">
                {/* Delivery Address */}
                <div className="cart-address">
                    <div className="cart-address__left">
                        <div className="cart-address__icon">
                            <MapPin size={18} />
                        </div>
                        <div>
                            <p className="cart-address__label">Entregar em</p>
                            <p className="cart-address__value">Rua das Palmeiras, 123 - Centro</p>
                        </div>
                    </div>
                    <button className="cart-address__change">Alterar</button>
                </div>

                {/* Cart Items */}
                <div className="cart-items">
                    {items.map(item => {
                        const key = `${item.produto_id}-${item.variacao_id || 'default'}`
                        return (
                            <div key={key} className="cart-item">
                                <div className="cart-item__image">
                                    <img
                                        src={getImageUrl(item.imagem_url) || 'https://via.placeholder.com/100?text=🍖'}
                                        alt={item.nome}
                                    />
                                </div>
                                <div className="cart-item__info">
                                    <div className="cart-item__top">
                                        <h3 className="cart-item__name">{item.nome}</h3>
                                        <button
                                            className="cart-item__remove"
                                            onClick={() => removeItem(item.produto_id, item.variacao_id)}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    {item.observacoes && (
                                        <p className="cart-item__obs">{item.observacoes}</p>
                                    )}
                                    <div className="cart-item__bottom">
                                        <span className="cart-item__price">{formatCurrency(item.preco * item.quantidade)}</span>
                                        <div className="cart-item__qty">
                                            <button
                                                className="cart-item__qty-btn"
                                                onClick={() => updateQuantity(item.produto_id, item.variacao_id, item.quantidade - 1)}
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="cart-item__qty-val">{item.quantidade}</span>
                                            <button
                                                className="cart-item__qty-btn cart-item__qty-btn--plus"
                                                onClick={() => updateQuantity(item.produto_id, item.variacao_id, item.quantidade + 1)}
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Upsell Section */}
                <div className="cart-upsell">
                    <h3 className="cart-upsell__title">
                        <span>🔥</span> Que tal uma bebida gelada?
                    </h3>
                    <div className="cart-upsell__scroll hide-scrollbar">
                        <div className="cart-upsell__card">
                            <button className="cart-upsell__add-btn">
                                <Plus size={14} />
                            </button>
                            <div className="cart-upsell__img-placeholder">🥤</div>
                            <p className="cart-upsell__name">Coca-Cola Lata</p>
                            <p className="cart-upsell__price">R$ 5,00</p>
                        </div>
                        <div className="cart-upsell__card">
                            <button className="cart-upsell__add-btn cart-upsell__add-btn--inactive">
                                <Plus size={14} />
                            </button>
                            <div className="cart-upsell__img-placeholder">🥤</div>
                            <p className="cart-upsell__name">Guaraná Lata</p>
                            <p className="cart-upsell__price">R$ 4,50</p>
                        </div>
                        <div className="cart-upsell__card">
                            <button className="cart-upsell__add-btn cart-upsell__add-btn--inactive">
                                <Plus size={14} />
                            </button>
                            <div className="cart-upsell__img-placeholder">🍊</div>
                            <p className="cart-upsell__name">Suco Natural</p>
                            <p className="cart-upsell__price">R$ 8,00</p>
                        </div>
                    </div>
                </div>

                {/* Cart Summary */}
                <div className="cart-summary">
                    <div className="cart-summary__row">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="cart-summary__row">
                        <span>Taxa de entrega</span>
                        <span>{formatCurrency(taxaEntrega)}</span>
                    </div>
                    <div className="cart-summary__row">
                        <span>Desconto</span>
                        <span className="cart-summary__discount">- R$ 0,00</span>
                    </div>
                    <div className="cart-summary__divider" />
                    <div className="cart-summary__total">
                        <span>Total</span>
                        <span className="cart-summary__total-value">{formatCurrency(total)}</span>
                    </div>
                </div>
            </div>

            {/* CTA Footer */}
            <div className="cart-footer">
                <button
                    className="cart-footer__btn"
                    onClick={() => navigate('/checkout')}
                >
                    <span>Finalizar Pedido</span>
                    <span className="cart-footer__btn-price">{formatCurrency(total)}</span>
                </button>
            </div>
        </div>
    )
}
