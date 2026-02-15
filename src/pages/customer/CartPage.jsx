import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X, Minus, Plus, MapPin, Truck, Store } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useProducts } from '../../hooks/useProducts'
import { useCustomer } from '../../context/CustomerContext'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import './CartPage.css'

export default function CartPage() {
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { items, removeItem, updateQuantity, clearCart, subtotal, addItem } = useCart()
    const { products } = useProducts()
    const { customer, updateCustomerData } = useCustomer()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    // Upsell: products NOT already in cart
    const cartProductIds = items.map(i => i.produto_id)
    const upsellProducts = products.filter(p => p.disponivel && !cartProductIds.includes(p.id))

    // Order type
    const [tipoPedido, setTipoPedido] = useState(() => {
        return localStorage.getItem('espetinho_tipo_pedido') || 'entrega'
    })

    // Address State
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
    const [addressData, setAddressData] = useState(() => {
        const saved = localStorage.getItem('espetinho_delivery_data')
        if (saved) {
            try {
                const data = JSON.parse(saved)
                // Backwards compatibility
                return {
                    rua: data.rua || data.street || '',
                    numero: data.numero || data.number || '',
                    bairro: data.bairro || data.neighborhood || '',
                    referencia: data.referencia || data.reference || '',
                    nome_recebedor: data.nome_recebedor || data.receiverName || '',
                    telefone_recebedor: data.telefone_recebedor || data.receiverPhone || ''
                }
            } catch { }
        }
        return {
            rua: '',
            numero: '',
            bairro: '',
            referencia: '',
            nome_recebedor: '',
            telefone_recebedor: ''
        }
    })

    // Freight Fees from DB
    const [freightFees, setFreightFees] = useState([])
    useEffect(() => {
        async function fetchFreights() {
            const { data } = await supabase.from('taxas_entrega').select('*').eq('ativo', true).order('local')
            if (data) setFreightFees(data)
        }
        fetchFreights()
    }, [])

    // Delivery costs
    const [taxaEntrega, setTaxaEntrega] = useState(0)

    useEffect(() => {
        if (tipoPedido === 'retirada') {
            setTaxaEntrega(0)
            return
        }

        // Try to find fee for current neighborhood
        const selectedNeighborhood = addressData.bairro
        const fee = freightFees.find(f => f.local === selectedNeighborhood)

        if (fee) {
            setTaxaEntrega(Number(fee.valor_frete))
        } else {
            // Fallback to store config if we had it, but for now use 0 or a default
            setTaxaEntrega(5.0) // Temporary fallback, will improve with useStore later if needed
        }
    }, [tipoPedido, addressData.neighborhood, freightFees])

    const total = subtotal + taxaEntrega

    // Sync addressData if customer changes and has saved info
    useEffect(() => {
        if (customer) {
            const currentLocal = localStorage.getItem('espetinho_delivery_data')
            const noManualOverride = !localStorage.getItem('espetinho_manual_address')
            const isActuallyEmpty = !addressData.rua || !currentLocal

            if (isActuallyEmpty || noManualOverride) {
                const dados = customer.dados || {}
                // Support both nested { endereco: { rua: ... } } and flat { rua: ... }
                const dbAddr = dados.endereco || dados || {}

                const newData = {
                    nome_recebedor: dados.nome_recebedor || dados.receiverName || dados.nome || customer.nome || '',
                    telefone_recebedor: dados.telefone_recebedor || dados.receiverPhone || dados.whatsapp || customer.telefone || '',
                    rua: dbAddr.rua || dbAddr.street || dbAddr.logradouro || '',
                    numero: dbAddr.numero || dbAddr.number || '',
                    bairro: dbAddr.bairro || dbAddr.neighborhood || '',
                    referencia: dbAddr.referencia || dbAddr.reference || dbAddr.ponto_referencia || ''
                }

                // Only set if we actually have at least something new or better
                if (newData.rua || newData.nome_recebedor) {
                    const isDifferent = JSON.stringify(newData) !== JSON.stringify(addressData)
                    if (isDifferent) {
                        setAddressData(newData)
                        localStorage.setItem('espetinho_delivery_data', JSON.stringify(newData))
                    }
                }
            }
        }
    }, [customer, addressData])

    // Temp state for editing
    const [tempData, setTempData] = useState(addressData)

    // Update tempData when addressData changes (e.g. after sync)
    useEffect(() => {
        setTempData(addressData)
    }, [addressData])

    const hasAddress = addressData.rua && addressData.nome_recebedor

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

    const handleSaveAddress = async () => {
        if (!tempData.rua || !tempData.nome_recebedor || !tempData.telefone_recebedor) {
            alert('Por favor, preencha os campos obrigatórios.')
            return
        }

        setAddressData(tempData)
        localStorage.setItem('espetinho_delivery_data', JSON.stringify(tempData))
        localStorage.setItem('espetinho_manual_address', 'true')

        const fullAddress = `${tempData.rua}, ${tempData.numero} - ${tempData.bairro}`
        localStorage.setItem('espetinho_delivery_address', fullAddress)

        // Persist to database if customer is logged in
        if (customer) {
            await updateCustomerData({
                nome_recebedor: tempData.nome_recebedor,
                telefone_recebedor: tempData.telefone_recebedor,
                endereco: {
                    rua: tempData.rua,
                    numero: tempData.numero,
                    bairro: tempData.bairro,
                    referencia: tempData.referencia
                }
            })
        }

        setIsAddressModalOpen(false)
    }

    if (items.length === 0) {
        return (
            <div className="cart-empty animate-fade-in">
                <span className="cart-empty__icon">🛒</span>
                <h2>Seu carrinho está vazio</h2>
                <p>Adicione itens do cardápio para fazer um pedido delicioso!</p>
                <button className="cart-empty__btn btn btn-primary btn-md" onClick={() => navigate(customerCode ? `/${customerCode}` : '/')}>
                    Ver Cardápio
                </button>
            </div>
        )
    }

    return (
        <div className="cart-page animate-fade-in">
            {/* Header */}
            <header className="cart-header">
                <button
                    className="cart-header__back"
                    onClick={() => navigate(customerCode ? `/${customerCode}` : '/')}
                    type="button"
                >
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
                                    {item.descricao && (
                                        <p className="cart-item__desc">{item.descricao}</p>
                                    )}
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
                                                <u size={12} />
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
                                        <p className="cart-address__value">{addressData.rua}, {addressData.numero}</p>
                                        <p className="cart-address__sub">{addressData.bairro}</p>
                                        <p className="cart-address__receiver">Para: {addressData.nome_recebedor}</p>
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
                    onClick={() => navigate(customerCode ? `/${customerCode}/checkout` : '/checkout')}
                >
                    <span>Finalizar Pedido</span>
                    <span className="cart-footer__btn-price">{formatCurrency(total)}</span>
                </button>
            </div>

            {/* ADDRESS BOTTOM SHEET MODAL */}
            {isAddressModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsAddressModalOpen(false)}>
                    <div className="bottom-sheet expanded" onClick={e => e.stopPropagation()}>
                        <div className="bottom-sheet__handle" />
                        <div className="bottom-sheet__header">
                            <h3>Endereço de Entrega</h3>
                            <button className="close-btn" onClick={() => setIsAddressModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bottom-sheet__content">
                            <div className="form-grid">
                                <div className="input-modern-group full">
                                    <label>Rua / Logradouro *</label>
                                    <input
                                        type="text"
                                        value={tempData.rua}
                                        onChange={e => setTempData({ ...tempData, rua: e.target.value })}
                                        placeholder="Ex: Rua das Flores"
                                    />
                                </div>

                                <div className="input-modern-group half">
                                    <label>Número *</label>
                                    <input
                                        type="text"
                                        value={tempData.numero}
                                        onChange={e => setTempData({ ...tempData, numero: e.target.value })}
                                        placeholder="Ex: 123"
                                    />
                                </div>
                                <div className="input-modern-group half">
                                    <label>Bairro *</label>
                                    <select
                                        className="modern-select"
                                        value={tempData.bairro}
                                        onChange={e => setTempData({ ...tempData, bairro: e.target.value })}
                                    >
                                        <option value="">Selecione...</option>
                                        {freightFees.map(f => (
                                            <option key={f.id} value={f.local}>
                                                {f.local} (+ {formatCurrency(f.valor_frete)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="input-modern-group full">
                                    <label>Ponto de Referência</label>
                                    <input
                                        type="text"
                                        value={tempData.referencia}
                                        onChange={e => setTempData({ ...tempData, referencia: e.target.value })}
                                        placeholder="Ex: Próximo à padaria"
                                    />
                                </div>

                                <div className="divider-label">Dados do Recebedor</div>

                                <div className="input-modern-group full">
                                    <label>Nome de quem recebe *</label>
                                    <input
                                        type="text"
                                        value={tempData.nome_recebedor}
                                        onChange={e => setTempData({ ...tempData, nome_recebedor: e.target.value })}
                                        placeholder="Seu nome"
                                    />
                                </div>

                                <div className="input-modern-group full">
                                    <label>WhatsApp para contato *</label>
                                    <input
                                        type="tel"
                                        value={tempData.telefone_recebedor}
                                        onChange={e => setTempData({ ...tempData, telefone_recebedor: formatPhone(e.target.value) })}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>

                                <button className="btn-save-address btn btn-primary full" onClick={handleSaveAddress}>
                                    Salvar Endereço
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
