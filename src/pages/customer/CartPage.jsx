import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Minus, Plus, MapPin, Truck, Store } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useProducts } from '../../hooks/useProducts'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import './CartPage.css'

export default function CartPage() {
    const navigate = useNavigate()
    const { items, removeItem, updateQuantity, clearCart, subtotal, addItem } = useCart()
    const { products } = useProducts()

    // Upsell: products NOT already in cart
    const cartProductIds = items.map(i => i.produto_id)
    const upsellProducts = products.filter(p => p.disponivel && !cartProductIds.includes(p.id))

    // Order type
    const [tipoPedido, setTipoPedido] = useState(() => {
        return localStorage.getItem('espetinho_tipo_pedido') || 'entrega'
    })

    // Delivery costs — zero if pickup
    const taxaEntrega = tipoPedido === 'entrega' ? 5.0 : 0
    const total = subtotal + taxaEntrega

    // Address State
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
    const [addressData, setAddressData] = useState(() => {
        const saved = localStorage.getItem('espetinho_delivery_data')
        if (saved) {
            try { return JSON.parse(saved) } catch { }
        }
        return {
            street: '',
            number: '',
            neighborhood: '',
            reference: '',
            receiverName: '',
            receiverPhone: ''
        }
    })

    // Temp state for editing
    const [tempData, setTempData] = useState(addressData)

    const hasAddress = addressData.street && addressData.receiverName

    const formatPhone = (value) => {
        return value
            .replace(/\D/g, '')
            .replace(/^(\d{2})(\d)/g, '($1) $2')
            .replace(/(\d)(\d{4})$/, '$1-$2')
            .slice(0, 15)
    }

    const handleTipoPedido = (tipo) => {
        setTipoPedido(tipo)
        localStorage.setItem('espetinho_tipo_pedido', tipo)
    }

    const handleOpenAddress = () => {
        setTempData(addressData)
        setIsAddressModalOpen(true)
    }

    const handleSaveAddress = () => {
        if (!tempData.street || !tempData.receiverName || !tempData.receiverPhone) {
            alert('Por favor, preencha os campos obrigatórios.')
            return
        }
        setAddressData(tempData)
        localStorage.setItem('espetinho_delivery_data', JSON.stringify(tempData))

        const fullAddress = `${tempData.street}, ${tempData.number} - ${tempData.neighborhood}`
        localStorage.setItem('espetinho_delivery_address', fullAddress)

        setIsAddressModalOpen(false)
    }

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

            <div className={`cart-scroll hide-scrollbar ${isAddressModalOpen ? 'blur-bg' : ''}`}>
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
                {upsellProducts.length > 0 && (
                    <div className="cart-upsell">
                        <h3 className="cart-upsell__title">Adicione também</h3>
                        <div className="cart-upsell__marquee-wrap hide-scrollbar">
                            <div className="cart-upsell__marquee">
                                {[...upsellProducts, ...upsellProducts].map((p, idx) => (
                                    <div key={`${p.id}-${idx}`} className="cart-upsell__card">
                                        <div className="cart-upsell__img-wrap">
                                            <img
                                                src={getImageUrl(p.imagem_url) || 'https://via.placeholder.com/80x80?text=🍖'}
                                                alt={p.nome}
                                                className="cart-upsell__img"
                                            />
                                        </div>
                                        <p className="cart-upsell__name">{p.nome}</p>
                                        <p className="cart-upsell__price">{formatCurrency(p.preco)}</p>
                                        <button
                                            className="cart-upsell__add-btn"
                                            onClick={() => addItem({
                                                produto_id: p.id,
                                                nome: p.nome,
                                                preco: p.preco,
                                                imagem_url: p.imagem_url,
                                                eh_upsell: true,
                                            })}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delivery or Pickup Toggle */}
                <div className="cart-order-type">
                    <div className="cart-order-type__toggle">
                        <button
                            className={`cart-order-type__btn ${tipoPedido === 'entrega' ? 'cart-order-type__btn--active' : ''}`}
                            onClick={() => handleTipoPedido('entrega')}
                        >
                            <Truck size={16} /> Entrega
                        </button>
                        <button
                            className={`cart-order-type__btn ${tipoPedido === 'retirada' ? 'cart-order-type__btn--active' : ''}`}
                            onClick={() => handleTipoPedido('retirada')}
                        >
                            <Store size={16} /> Retirada
                        </button>
                    </div>
                </div>

                {/* Delivery Address — only if "entrega" */}
                {tipoPedido === 'entrega' && (
                    <div className="cart-address" onClick={handleOpenAddress}>
                        <div className="cart-address__left">
                            <div className="cart-address__icon">
                                <MapPin size={18} />
                            </div>
                            <div>
                                <p className="cart-address__label">Endereço</p>
                                {hasAddress ? (
                                    <>
                                        <p className="cart-address__value">{addressData.street}, {addressData.number}</p>
                                        <p className="cart-address__sub">{addressData.neighborhood}</p>
                                        <p className="cart-address__receiver">Para: {addressData.receiverName}</p>
                                    </>
                                ) : (
                                    <p className="cart-address__value cart-address__value--empty">Toque para adicionar</p>
                                )}
                            </div>
                        </div>
                        <button className="cart-address__change">{hasAddress ? 'Alterar' : 'Adicionar'}</button>
                    </div>
                )}

                {/* Cart Summary */}
                <div className="cart-summary">
                    <div className="cart-summary__row">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {tipoPedido === 'entrega' && (
                        <div className="cart-summary__row">
                            <span>Taxa de entrega</span>
                            <span>{formatCurrency(taxaEntrega)}</span>
                        </div>
                    )}
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

            {/* ADDRESS BOTTOM SHEET MODAL */}
            {isAddressModalOpen && (
                <>
                    <div className="modal-backdrop fade-in" onClick={() => setIsAddressModalOpen(false)} />
                    <div className="bottom-sheet slide-up expanded">
                        <div className="bottom-sheet__handle" />
                        <div className="bottom-sheet__header">
                            <h3>Endereço de Entrega</h3>
                            <button className="close-btn" onClick={() => setIsAddressModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bottom-sheet__content hide-scrollbar">
                            <div className="form-grid">
                                <div className="input-modern-group full">
                                    <label>Rua / Avenida</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Rua das Flores"
                                        value={tempData.street}
                                        onChange={e => setTempData({ ...tempData, street: e.target.value })}
                                    />
                                </div>

                                <div className="input-modern-group half">
                                    <label>Número</label>
                                    <input
                                        type="text"
                                        placeholder="123"
                                        value={tempData.number}
                                        onChange={e => setTempData({ ...tempData, number: e.target.value })}
                                    />
                                </div>

                                <div className="input-modern-group half">
                                    <label>Bairro</label>
                                    <input
                                        type="text"
                                        placeholder="Centro"
                                        value={tempData.neighborhood}
                                        onChange={e => setTempData({ ...tempData, neighborhood: e.target.value })}
                                    />
                                </div>

                                <div className="input-modern-group full">
                                    <label>Ponto de Referência</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Ao lado da padaria"
                                        value={tempData.reference}
                                        onChange={e => setTempData({ ...tempData, reference: e.target.value })}
                                    />
                                </div>

                                <div className="divider-label">Quem vai receber?</div>

                                <div className="input-modern-group full">
                                    <label>Nome do Recebedor</label>
                                    <input
                                        type="text"
                                        placeholder="Seu nome"
                                        value={tempData.receiverName}
                                        onChange={e => setTempData({ ...tempData, receiverName: e.target.value })}
                                    />
                                </div>

                                <div className="input-modern-group full">
                                    <label>Celular / WhatsApp</label>
                                    <input
                                        type="tel"
                                        placeholder="(00) 00000-0000"
                                        value={tempData.receiverPhone}
                                        onChange={e => setTempData({ ...tempData, receiverPhone: formatPhone(e.target.value) })}
                                        maxLength={15}
                                    />
                                </div>
                            </div>

                            <button className="btn-save-address" onClick={handleSaveAddress}>
                                Salvar Endereço
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
