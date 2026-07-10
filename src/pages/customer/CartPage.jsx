import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X, Minus, Plus, MapPin, Truck, Store, Navigation, MapPinOff } from 'lucide-react'
import { useCart, getItemKey } from '../../hooks/useCart'
import { useProducts } from '../../hooks/useProducts'
import { useOrders, useComanda } from '../../hooks/useOrders'
import { useCustomer } from '../../context/CustomerContext'
import { formatCurrency, getImageUrl, filterPersonalizacao } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import OptimizedImage from '../../components/ui/OptimizedImage'
import Button from '../../components/ui/Button'
import StockWarningModal from '../../components/customer/StockWarningModal'
import './CartPage.css'

export default function CartPage() {
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { items, removeItem, updateQuantity, clearCart, subtotal, addItem } = useCart()
    const { products } = useProducts()
    const { customer, updateCustomerData } = useCustomer()
    const [isGeolocating, setIsGeolocating] = useState(false)
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false)
    const [showLocationPrompt, setShowLocationPrompt] = useState(false)
    const [stockWarning, setStockWarning] = useState({ open: false, product: '', qty: 0 })
    const [addressError, setAddressError] = useState({ open: false, message: '' })

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

    const comandaId = tipoPedido === 'mesa' ? localStorage.getItem('espetinho_comanda_id') : null
    const { orders: tableOrders, loading: loadingTableOrders } = useComanda(comandaId)
    const tableItems = tableOrders.flatMap(o => o.itens_pedido || [])
    const tableTotal = tableOrders.reduce((acc, order) => acc + (order.pago ? 0 : order.valor_total), 0)

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
                    telefone_recebedor: data.telefone_recebedor || data.receiverPhone || '',
                    google_maps_link: data.google_maps_link || ''
                }
            } catch { }
        }
        return {
            rua: '',
            numero: '',
            bairro: '',
            referencia: '',
            nome_recebedor: '',
            telefone_recebedor: '',
            google_maps_link: ''
        }
    })

    // Freight Fees from DB
    const [freightFees, setFreightFees] = useState([])
    const fetchFreights = async () => {
        const { data } = await supabase.from('taxas_entrega').select('*').eq('ativo', true).order('local')
        if (data) setFreightFees(data)
    }

    useEffect(() => {
        fetchFreights()

        const channel = supabase
            .channel('shipping-rates-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'taxas_entrega' }, () => {
                fetchFreights()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Delivery costs
    const [taxaEntrega, setTaxaEntrega] = useState(0)

    useEffect(() => {
        if (tipoPedido === 'retirada' || tipoPedido === 'mesa') {
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
    }, [tipoPedido, addressData.bairro, freightFees])

    const total = subtotal + taxaEntrega

    // Sync addressData if customer changes and has saved info
    useEffect(() => {
        if (customer) {
            const currentLocal = localStorage.getItem('espetinho_delivery_data')
            const noManualOverride = !localStorage.getItem('espetinho_manual_address')
            const isActuallyEmpty = !addressData.rua || !currentLocal

            // If we have no local data OR we don't have a manual override recorded yet,
            // we should favor the database content.
            if (isActuallyEmpty || noManualOverride) {
                const dados = customer.dados || {}
                const dbAddr = dados.endereco || dados || {}

                const newData = {
                    nome_recebedor: dados.nome_recebedor || dados.receiverName || dados.nome || customer.nome || '',
                    telefone_recebedor: dados.telefone_recebedor || dados.receiverPhone || dados.whatsapp || customer.telefone || '',
                    rua: dbAddr.rua || dbAddr.street || dbAddr.logradouro || '',
                    numero: dbAddr.numero || dbAddr.number || '',
                    bairro: dbAddr.bairro || dbAddr.neighborhood || '',
                    referencia: dbAddr.referencia || dbAddr.reference || dbAddr.ponto_referencia || '',
                    google_maps_link: dbAddr.google_maps_link || ''
                }

                // If the DB has information, we update
                if (newData.rua || newData.nome_recebedor || newData.google_maps_link) {
                    const isDifferent = JSON.stringify(newData) !== JSON.stringify(addressData)
                    if (isDifferent) {
                        setAddressData(newData)
                        localStorage.setItem('espetinho_delivery_data', JSON.stringify(newData))
                    }
                }
            }
        }
    }, [customer]) // Removed addressData from dependencies to prevent infinite loop or override cycles
    // Temp state for editing
    const [tempData, setTempData] = useState(addressData)

    // Update tempData when addressData changes (e.g. after sync)
    // BUT: never overwrite if the user is actively editing (modal open)
    useEffect(() => {
        if (!isAddressModalOpen) {
            setTempData(addressData)
        }
    }, [addressData, isAddressModalOpen])

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

    const handleGetCurrentLocation = (autoSave = false) => {
        if (!navigator.geolocation) {
            alert('Geolocalização não é suportada pelo seu navegador.')
            return
        }

        setIsGeolocating(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                const link = `https://www.google.com/maps?q=${latitude},${longitude}`
                setTempData(prev => ({
                    ...prev,
                    google_maps_link: link
                }))
                setIsGeolocating(false)

                if (autoSave) {
                    executeSaveAddress({ ...tempData, google_maps_link: link })
                }
            },
            (error) => {
                console.error('Erro de geolocalização:', error)
                setIsGeolocating(false)
                alert('Não foi possível obter sua localização. Verifique se o GPS está ligado e as permissões de localização do navegador.')
            },
            { enableHighAccuracy: true, timeout: 5000 }
        )
    }

    const handleOpenAddress = () => {
        setTempData(addressData)
        setIsAddressModalOpen(true)
    }

    const executeSaveAddress = async (dataToSave) => {
        setAddressData(dataToSave)
        localStorage.setItem('espetinho_delivery_data', JSON.stringify(dataToSave))
        localStorage.setItem('espetinho_manual_address', 'true')

        const fullAddress = `${dataToSave.rua}, ${dataToSave.numero} - ${dataToSave.bairro}`
        localStorage.setItem('espetinho_delivery_address', fullAddress)

        // Persist to database if customer is logged in
        if (customer) {
            await updateCustomerData({
                nome_recebedor: dataToSave.nome_recebedor,
                telefone_recebedor: dataToSave.telefone_recebedor,
                endereco: {
                    rua: dataToSave.rua,
                    numero: dataToSave.numero,
                    bairro: dataToSave.bairro,
                    referencia: dataToSave.referencia,
                    google_maps_link: dataToSave.google_maps_link
                }
            })
        }

        setIsAddressModalOpen(false)
        setShowLocationPrompt(false)
    }

    const handleSaveAddress = async (forceWithoutLocation = false) => {
        // Validation: require at least 2 letters (blocks dots, emojis, single chars)
        const letrasNoNome = (tempData.nome_recebedor || '').match(/[a-zA-ZÀ-ÿ]/g)
        const hasText = letrasNoNome && letrasNoNome.length >= 2

        if (!tempData.rua || !tempData.numero) {
            setAddressError({ open: true, message: 'Por favor, informe a rua e o número da sua residência.' })
            return
        }
        if (!tempData.bairro) {
            setAddressError({ open: true, message: 'Você precisa selecionar seu bairro para calcularmos a entrega.' })
            return
        }
        if (!tempData.nome_recebedor || !hasText) {
            setAddressError({ open: true, message: 'Por favor, insira um nome válido com pelo menos 2 letras.' })
            return
        }
        if (!tempData.telefone_recebedor || tempData.telefone_recebedor.length < 14) {
            setAddressError({ open: true, message: 'Por favor, informe um WhatsApp válido para contato.' })
            return
        }

        if (!tempData.google_maps_link && !forceWithoutLocation) {
            setShowLocationPrompt(true)
            return
        }

        await executeSaveAddress(tempData)
    }

    const handleFinalize = () => {
        if (tipoPedido === 'entrega' && !hasAddress) {
            setIsValidationModalOpen(true)
            return
        }
        navigate(customerCode ? `/${customerCode}/checkout` : '/checkout')
    }

    // --- Interactive Auto-Scroll for "Adicione também" ---
    const scrollRef = useRef(null)
    const [isPaused, setIsPaused] = useState(false)

    useEffect(() => {
        const container = scrollRef.current
        if (!container || !upsellProducts || upsellProducts.length === 0) return

        let animationFrameId
        const scrollSpeed = 1 // Use integer for better iOS compatibility

        // Initial offset to allow backward scrolling
        const setInitialPos = () => {
            if (container.scrollLeft === 0 && container.scrollWidth > container.clientWidth) {
                const segmentWidth = container.scrollWidth / 3
                container.scrollLeft = segmentWidth
            }
        }

        // Try multiple times as images/layout settle
        setInitialPos()
        const timer1 = setTimeout(setInitialPos, 100)
        const timer2 = setTimeout(setInitialPos, 500)
        const timer3 = setTimeout(setInitialPos, 1500)

        const animate = () => {
            if (!isPaused && container) {
                container.scrollLeft += scrollSpeed
                const segmentWidth = container.scrollWidth / 3

                if (segmentWidth > 0) {
                    // Forward reset
                    if (container.scrollLeft >= segmentWidth * 2) {
                        container.scrollLeft -= segmentWidth
                    }
                    // Backward reset (for manual scrolling)
                    if (container.scrollLeft <= 2) {
                        container.scrollLeft += segmentWidth
                    }
                }
            }
            animationFrameId = requestAnimationFrame(animate)
        }

        animationFrameId = requestAnimationFrame(animate)
        return () => {
            cancelAnimationFrame(animationFrameId)
            clearTimeout(timer1)
            clearTimeout(timer2)
            clearTimeout(timer3)
        }
    }, [isPaused, upsellProducts?.length])

    if (items.length === 0 && tableItems.length === 0) {
        return (
            <div className="cart-empty animate-fade-in">
                <span className="cart-empty__icon">🛒</span>
                <h2>Seu carrinho está vazio</h2>
                <p>Adicione itens do cardápio para fazer um pedido delicioso!</p>
                <Button onClick={() => navigate(customerCode ? `/${customerCode}` : '/')}>
                    Ver Cardápio
                </Button>
            </div>
        )
    }

    // Protect finalize from attempting to create an empty local order
    const canFinalize = items.length > 0

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
                {/* Table Items (Already ordered) */}
                {tableItems.length > 0 && (
                    <div className="cart-table-items" style={{ padding: '16px', background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🍽️</span> Já pedidos nesta mesa
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tableItems.map((item, idx) => (
                                <div key={item.id || idx} style={{ display: 'flex', gap: '12px', opacity: 0.8 }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid #eee' }}>
                                        <OptimizedImage
                                            src={getImageUrl(item.produtos?.imagem_url) || 'https://via.placeholder.com/48?text=🍖'}
                                            alt={item.produtos?.nome || 'Item'}
                                            width={48}
                                            height={48}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h4 style={{ fontSize: '14px', margin: 0, fontWeight: '500' }}>
                                                {item.quantidade}x {item.produtos?.nome}
                                            </h4>
                                            <span style={{ fontSize: '14px', fontWeight: '600' }}>
                                                {formatCurrency(item.preco_unitario * item.quantidade)}
                                            </span>
                                        </div>
                                        {item.variacoes_produto && (
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                                                Variação: {item.variacoes_produto.nome}
                                            </p>
                                        )}
                                        {item.personalizacao && typeof item.personalizacao === 'object' && (() => {
                                            const filtered = filterPersonalizacao(item.personalizacao, item.produtos?.nome)
                                            return filtered.length > 0 && (
                                                <div style={{ marginTop: '4px' }}>
                                                    {filtered.map(({ key, value }, i) => (
                                                        <p key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                                            <strong>{key}:</strong> {value}
                                                        </p>
                                                    ))}
                                                </div>
                                            )
                                        })()}
                                        {item.observacoes && (
                                            <p style={{ fontSize: '12px', color: 'var(--cor-destaque)', fontWeight: '500', margin: '4px 0 0 0' }}>
                                                OBS: {item.observacoes}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Total já consumido</span>
                            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(tableTotal)}</span>
                        </div>
                    </div>
                )}

                {/* Local Cart Items */}
                <div className="cart-items">
                    {items.length === 0 && tableItems.length > 0 && (
                        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Você não tem novos itens na sua sacola.</p>
                            <Button onClick={() => navigate(customerCode ? `/${customerCode}` : '/')} style={{ marginTop: '16px' }}>
                                Adicionar mais itens
                            </Button>
                        </div>
                    )}
                    {items.map(item => {
                        const key = getItemKey(item)
                        return (
                            <div key={key} className="cart-item">
                                <div className="cart-item__image">
                                    <OptimizedImage
                                        src={getImageUrl(item.imagem_url) || 'https://via.placeholder.com/100?text=🍖'}
                                        alt={item.nome}
                                        width={100}
                                        height={100}
                                    />
                                </div>
                                <div className="cart-item__info">
                                    <div className="cart-item__top">
                                        <h3 className="cart-item__name">{item.nome}</h3>
                                        <button
                                            className="cart-item__remove"
                                            onClick={() => removeItem(item)}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    {item.descricao && (
                                        <p className="cart-item__desc">{item.descricao}</p>
                                    )}
                                    {item.personalizacao && typeof item.personalizacao === 'object' && (() => {
                                        const filtered = filterPersonalizacao(item.personalizacao, item.nome)
                                        return filtered.length > 0 && (
                                            <div className="cart-item__details">
                                                {filtered.map(({ key, value }) => (
                                                    <p key={key} className="cart-item__detail">
                                                        <strong>{key}:</strong> {value}
                                                    </p>
                                                ))}
                                            </div>
                                        )
                                    })()}
                                    {item.observacoes && (
                                        <p className="cart-item__obs">OBS: {item.observacoes}</p>
                                    )}
                                    <div className="cart-item__bottom">
                                        <span className="cart-item__price">{formatCurrency(item.preco * item.quantidade)}</span>
                                        <div className="cart-item__qty">
                                            <button
                                                className="cart-item__qty-btn"
                                                onClick={() => updateQuantity(item, item.quantidade - 1)}
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="cart-item__qty-val">{item.quantidade}</span>
                                            <button
                                                className="cart-item__qty-btn cart-item__qty-btn--plus"
                                                onClick={() => {
                                                    const prodData = products.find(p => p.id === item.produto_id)
                                                    if (prodData && prodData.controlar_estoque && item.quantidade >= prodData.quantidade_disponivel) {
                                                        setStockWarning({
                                                            open: true,
                                                            product: prodData.nome,
                                                            qty: prodData.quantidade_disponivel
                                                        })
                                                        return
                                                    }
                                                    updateQuantity(item, item.quantidade + 1)
                                                }}
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
                        <div
                            className={`cart-upsell__marquee-wrap hide-scrollbar ${isPaused ? 'is-paused' : ''}`}
                            ref={scrollRef}
                            onMouseEnter={() => setIsPaused(true)}
                            onMouseLeave={() => setIsPaused(false)}
                            onTouchStart={() => setIsPaused(true)}
                            onTouchEnd={() => {
                                // Short delay to allow momentum scroll to finish
                                setTimeout(() => setIsPaused(false), 1500)
                            }}
                        >
                            <div className="cart-upsell__marquee">
                                {[...upsellProducts, ...upsellProducts, ...upsellProducts].map((p, idx) => (
                                    <div key={`${p.id}-${idx}`} className="cart-upsell__card">
                                        <div className="cart-upsell__img-wrap">
                                            <OptimizedImage
                                                src={getImageUrl(p.imagem_url) || 'https://via.placeholder.com/80x80?text=🍖'}
                                                alt={p.nome}
                                                className="cart-upsell__img"
                                            />
                                        </div>
                                        <p className="cart-upsell__name">{p.nome}</p>
                                        <p className="cart-upsell__price">{formatCurrency(p.preco)}</p>
                                        <button
                                            className="cart-upsell__add-btn"
                                            disabled={p.quantidade_disponivel === 0}
                                            onClick={() => {
                                                if (p.quantidade_disponivel === 0) return

                                                // Check if product has variations or customizations
                                                const hasOptions = (p.variacoes_produto?.length > 0) || (p.opcoes_personalizacao?.length > 0)

                                                if (hasOptions) {
                                                    navigate(customerCode
                                                        ? `/${customerCode}/produto/${p.id}?upsell=true`
                                                        : `/produto/${p.id}?upsell=true`
                                                    )
                                                    return
                                                }

                                                addItem({
                                                    produto_id: p.id,
                                                    nome: p.nome,
                                                    preco: p.preco,
                                                    imagem_url: p.imagem_url,
                                                    eh_upsell: true,
                                                })
                                            }}
                                            style={p.quantidade_disponivel === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        >
                                            {p.quantidade_disponivel === 0 ? <span style={{ fontSize: '10px' }}>OFF</span> : <Plus size={14} />}
                                        </button>
                                        {p.quantidade_disponivel === 0 && (
                                            <div className="cart-upsell__out-label">Esgotado</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delivery or Pickup Toggle (hide for mesa) */}
                {tipoPedido !== 'mesa' && (
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
                )}

                {/* Delivery Address — only if "entrega" — NOT for mesa */}
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
                {items.length > 0 && (
                    <div className="cart-summary">
                        <div className="cart-summary__row">
                            <span>Subtotal (Novos)</span>
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
                            <span>Total deste Pedido</span>
                            <span className="cart-summary__total-value">{formatCurrency(total)}</span>
                        </div>
                        {tableItems.length > 0 && (
                            <div className="cart-summary__row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Final da Mesa</span>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>{formatCurrency(total + tableTotal)}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* CTA Footer */}
            <div className="cart-footer">
                <button
                    className={`cart-footer__btn ${!canFinalize ? 'cart-footer__btn--disabled' : ''}`}
                    onClick={() => canFinalize && handleFinalize()}
                    style={{ opacity: canFinalize ? 1 : 0.5, cursor: canFinalize ? 'pointer' : 'not-allowed' }}
                >
                    {canFinalize ? `Finalizar Novos Itens ${formatCurrency(total)}` : 'Adicione itens para pedir'}
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
                            <button
                                className={`btn-locate ${isGeolocating ? 'is-loading' : ''} ${tempData.google_maps_link ? 'is-success' : ''}`}
                                onClick={() => handleGetCurrentLocation(false)}
                                disabled={isGeolocating}
                            >
                                <Navigation size={18} className={isGeolocating ? 'animate-spin' : ''} />
                                {isGeolocating
                                    ? 'Obtendo localização...'
                                    : tempData.google_maps_link
                                        ? 'Localização vinculada ✅'
                                        : 'Usar localização atual 📍'}
                            </button>

                            {tempData.google_maps_link && (
                                <p className="location-success-tip">
                                    📍 GPS vinculado! Isso ajuda o entregador a te encontrar rápido.
                                </p>
                            )}

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

                                <button className="btn-save-address btn btn-primary full" onClick={() => handleSaveAddress(false)}>
                                    Salvar Endereço
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* VALIDATION MODAL */}
            {isValidationModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsValidationModalOpen(false)}>
                    <div className="bottom-sheet validation-modal" onClick={e => e.stopPropagation()}>
                        <div className="bottom-sheet__handle" />
                        <div className="validation-content">
                            <div className="validation-icon">
                                <MapPin size={48} color="var(--cor-primaria)" />
                            </div>
                            <h3>Endereço não informado</h3>
                            <p>Por favor, insira seu endereço para entrega para continuar com o pedido.</p>
                            <button
                                className="btn btn-primary btn-md btn-full"
                                onClick={() => {
                                    setIsValidationModalOpen(false)
                                    handleOpenAddress()
                                }}
                            >
                                Inserir Endereço
                            </button>
                            <button
                                className="btn btn-ghost full"
                                onClick={() => setIsValidationModalOpen(false)}
                                style={{ marginTop: 8 }}
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* LOCATION PROMPT MODAL */}
            {showLocationPrompt && (
                <div className="modal-backdrop" onClick={() => !isGeolocating && setShowLocationPrompt(false)} style={{ zIndex: 9999 }}>
                    <div className="bottom-sheet validation-modal" onClick={e => e.stopPropagation()}>
                        <div className="bottom-sheet__handle" />
                        <div className="validation-content">
                            <div className="validation-icon" style={{ background: '#e8f0fe', color: '#1a73e8' }}>
                                <Navigation size={48} />
                            </div>
                            <h3>Usar sua localização?</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                O entregador encontra seu endereço muito mais rápido se você enviar a localização do GPS. Deseja usar sua localização atual?
                            </p>

                            <button
                                className={`btn btn-primary btn-md btn-full ${isGeolocating ? 'is-loading' : ''}`}
                                onClick={() => handleGetCurrentLocation(true)}
                                disabled={isGeolocating}
                            >
                                {isGeolocating ? (
                                    <span className="btn-spinner" />
                                ) : (
                                    <>Sim, usar localização 📍</>
                                )}
                            </button>
                            <button
                                className="btn btn-ghost full"
                                onClick={() => handleSaveAddress(true)}
                                disabled={isGeolocating}
                                style={{ marginTop: 8 }}
                            >
                                Não, salvar sem localização
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ADDRESS ERROR MODAL */}
            {addressError.open && (
                <div className="modal-backdrop" onClick={() => setAddressError({ open: false, message: '' })} style={{ zIndex: 10000 }}>
                    <div className="bottom-sheet validation-modal" onClick={e => e.stopPropagation()}>
                        <div className="bottom-sheet__handle" />
                        <div className="validation-content">
                            <div className="validation-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                                <X size={48} />
                            </div>
                            <h3>Dados Incompletos</h3>
                            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                                {addressError.message}
                            </p>

                            <button
                                className="btn btn-primary btn-md btn-full"
                                onClick={() => setAddressError({ open: false, message: '' })}
                            >
                                Entendi, vou preencher
                            </button>
                        </div>
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
