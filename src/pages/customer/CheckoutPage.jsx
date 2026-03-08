import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard, Receipt, Edit3, CheckCircle, User } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useOrders } from '../../hooks/useOrders'
import { useCustomer } from '../../context/CustomerContext'
import { formatCurrency, getImageUrl, filterPersonalizacao } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import './CheckoutPage.css'

export default function CheckoutPage() {
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { items, subtotal, clearCart } = useCart()
    const { createOrder, loading } = useOrders()
    const { customer, updateLastOrder } = useCustomer()
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    // Order type
    const [tipoPedido, setTipoPedido] = useState(() => {
        return localStorage.getItem('espetinho_tipo_pedido') || 'entrega'
    })

    useEffect(() => {
        localStorage.setItem('espetinho_tipo_pedido', tipoPedido)
    }, [tipoPedido])

    // Mesa data (from QR code scan)
    const mesaId = tipoPedido === 'mesa' ? localStorage.getItem('espetinho_mesa_id') : null
    const mesaNumero = tipoPedido === 'mesa' ? localStorage.getItem('espetinho_mesa_numero') : null

    // Address Data
    const [addressData, setAddressData] = useState(() => {
        const saved = localStorage.getItem('espetinho_delivery_data')
        if (saved) {
            try {
                const data = JSON.parse(saved)
                return {
                    rua: data.rua || data.street || '',
                    numero: data.numero || data.number || '',
                    bairro: data.bairro || data.neighborhood || '',
                    referencia: data.referencia || data.reference || '',
                    nome_recebedor: data.nome_recebedor || data.receiverName || '',
                    telefone_recebedor: data.telefone_recebedor || data.receiverPhone || '',
                    google_maps_link: data.google_maps_link || ''
                }
            } catch {
                // Ignore parsing errors
            }
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

    // Fetch Neighborhood Fee
    const [taxaEntrega, setTaxaEntrega] = useState(0)

    useEffect(() => {
        async function fetchFee() {
            if (tipoPedido === 'retirada' || tipoPedido === 'mesa' || !addressData.bairro) {
                setTaxaEntrega(0)
                return
            }

            const { data } = await supabase
                .from('taxas_entrega')
                .select('valor_frete')
                .eq('local', addressData.bairro)
                .single()

            if (data) {
                setTaxaEntrega(Number(data.valor_frete))
            } else {
                setTaxaEntrega(5.0) // Fallback
            }
        }
        fetchFee()
    }, [tipoPedido, addressData.bairro])

    const total = subtotal + taxaEntrega

    const [formaPagamento, setFormaPagamento] = useState('pix')
    const [precisaTroco, setPrecisaTroco] = useState(false)
    const [trocoPara, setTrocoPara] = useState('')
    const [observacoes, setObservacoes] = useState('')
    const [nomeRetirada, setNomeRetirada] = useState(customer?.nome || '')

    // Sync data when customer loads
    useEffect(() => {
        if (customer) {
            // Update name for pickup
            if (!nomeRetirada) setNomeRetirada(customer.nome)

            // Update delivery data if we have it in DB and local is empty or mismatch
            const dados = customer.dados || {}
            const dbAddr = dados.endereco || dados || {}

            const currentLocal = localStorage.getItem('espetinho_delivery_data')
            const noManualOverride = !localStorage.getItem('espetinho_manual_address')
            const isActuallyEmpty = !addressData.rua || !currentLocal

            if (dbAddr.rua || dados.nome_recebedor || dbAddr.google_maps_link) {
                if (isActuallyEmpty || noManualOverride) {
                    const newData = {
                        nome_recebedor: dados.nome_recebedor || dados.receiverName || dados.nome || customer.nome || '',
                        telefone_recebedor: (dados.whatsapp || dados.telefone_recebedor || dados.receiverPhone || customer.telefone || '').replace(/@s.whatsapp.net/g, ''),
                        rua: dbAddr.rua || dbAddr.street || dbAddr.logradouro || '',
                        numero: dbAddr.numero || dbAddr.number || '',
                        bairro: dbAddr.bairro || dbAddr.neighborhood || '',
                        referencia: dbAddr.referencia || dbAddr.reference || dbAddr.ponto_referencia || '',
                        google_maps_link: dbAddr.google_maps_link || ''
                    }

                    const isDifferent = JSON.stringify(newData) !== JSON.stringify(addressData)
                    if (isDifferent) {
                        localStorage.setItem('espetinho_delivery_data', JSON.stringify(newData))
                        setAddressData(newData)
                    }
                }
            }
        }
    }, [customer, addressData])



    const hasAddress = !!(addressData.rua && addressData.nome_recebedor)

    async function handleConfirm() {
        if (tipoPedido === 'entrega' && !hasAddress) {
            alert('Volte ao carrinho e preencha o endereço de entrega.')
            navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')
            return
        }

        if (tipoPedido === 'mesa' && !mesaId) {
            alert('Erro: mesa não identificada. Escaneie o QR code novamente.')
            return
        }

        if (isSubmitting) return
        setIsSubmitting(true)

        try {
            const nomeCliente = tipoPedido === 'mesa'
                ? (nomeRetirada || `Mesa ${mesaNumero}`)
                : tipoPedido === 'retirada'
                    ? nomeRetirada
                    : (addressData.nome_recebedor || '')

            let comandaId = localStorage.getItem('espetinho_comanda_id')
            if (tipoPedido === 'mesa' && !comandaId) {
                comandaId = crypto.randomUUID()
                localStorage.setItem('espetinho_comanda_id', comandaId)
            }

            const orderData = {
                nome_cliente: nomeCliente,
                telefone_cliente: tipoPedido === 'mesa' ? '' : (addressData.telefone_recebedor || ''),
                tipo_pedido: tipoPedido,
                subtotal,
                taxa_entrega: taxaEntrega,
                valor_total: total,
                forma_pagamento: tipoPedido === 'mesa' ? 'pagar_na_mesa' : formaPagamento,
                metodo_pagamento: tipoPedido === 'mesa' ? 'pagar_na_mesa' : formaPagamento,
                troco_para: precisaTroco ? parseFloat(trocoPara) : null,
                endereco: tipoPedido === 'entrega' ? addressData : null,
                observacoes: tipoPedido === 'mesa' ? `Mesa ${mesaNumero}${observacoes ? ' | ' + observacoes : ''}` : observacoes,
                mesa_id: mesaId || null,
                comanda_id: comandaId || null,
                pago: false,
                comanda_status: comandaId ? 'aberta' : null,
                itens: items,
                cliente_id: tipoPedido === 'mesa' ? null : (customer?.id || null),
                codigo_cliente: tipoPedido === 'mesa' ? null : customerCode
            }

            const summary = items.map(item => {
                let name = `${item.quantidade}x ${item.nome || 'Item'}`
                if (item.personalizacao) {
                    const extras = Object.values(item.personalizacao)
                        .flat()
                        .filter(v => typeof v === 'string' && v.length > 0)
                        .join(', ')
                    if (extras) name += ` (${extras})`
                }
                return name
            }).join(', ')
            const pedido = await createOrder(orderData)

            // Sync comanda_id from the server (may have been adopted from an existing table order)
            if (pedido.comanda_id) {
                localStorage.setItem('espetinho_comanda_id', pedido.comanda_id)
            }

            const targetClientId = pedido.cliente_id || customer?.id

            if (tipoPedido !== 'mesa' && targetClientId) {
                await updateLastOrder(
                    `Pedido #${pedido.numero_pedido || pedido.id.slice(0, 5)}: ${summary}`,
                    tipoPedido === 'entrega' ? addressData : null,
                    targetClientId,
                    { nome: orderData.nome_cliente }
                )
            }

            // Webhook notification (espetinho domain)
            try {
                const webhookBody = {
                    ...orderData,
                    ...pedido, // Overwrites initial nulls with actual DB values (like cliente_id, comanda_id)
                    cliente_original: customer
                }

                await fetch('https://espetinho-n8n-webhook.e2u8y7.easypanel.host/webhook/pedido_feito', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookBody)
                })

                // If it's delivery, notify all drivers via OneSignal
                if (tipoPedido === 'entrega') {
                    console.log('[Notification] Triggering notify-driver for new order...')
                    const enderecoBairro = typeof addressData === 'object' ? (addressData.bairro || '') : ''
                    supabase.functions.invoke('notify-driver', {
                        body: {
                            numero_pedido: pedido.numero_pedido,
                            nome_cliente: orderData.nome_cliente,
                            endereco_bairro: enderecoBairro,
                            valor_total: orderData.valor_total,
                            tipo_notificacao: 'novo_pedido'
                        }
                    }).then(({ error }) => {
                        if (error) console.error('[Notification] Error calling notify-driver:', error)
                        else console.log('[Notification] Driver notification sent successfully')
                    })
                }
            } catch (webhookErr) {
                console.error('Erro ao enviar webhook/notificação:', webhookErr)
            }

            clearCart()
            localStorage.setItem('espetinho_ultimo_pedido_id', pedido.id)
            navigate(customerCode ? `/${customerCode}/pedido/${pedido.id}` : `/pedido/${pedido.id}`)
        } catch (err) {
            alert('Erro ao confirmar pedido: ' + err.message)
            setIsSubmitting(false)
        }
    }

    if (items.length === 0) {
        return (
            <div className="checkout-empty animate-fade-in">
                <span className="checkout-empty__icon">🛒</span>
                <h2>Nenhum item no carrinho</h2>
                <p>Adicione itens antes de finalizar o pedido.</p>
                <button className="btn btn-primary btn-md" onClick={() => navigate(customerCode ? `/${customerCode}` : '/')}>
                    Ver Cardápio
                </button>
            </div>
        )
    }

    return (
        <div className="checkout-page animate-fade-in">
            {/* Header */}
            <header className="checkout-header">
                <button
                    type="button"
                    className="checkout-header__back"
                    onClick={() => navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')}
                >
                    <ArrowLeft size={22} />
                </button>
                <h1>Confirmar Pedido</h1>
                <div style={{ width: 40 }} />
            </header>

            <main className="checkout-main">
                {/* Mesa Badge */}
                {tipoPedido === 'mesa' && (
                    <div className="checkout-mesa-badge">
                        <span>🍽️</span>
                        <strong>Mesa {mesaNumero}</strong>
                        <small>Pedido na mesa</small>
                    </div>
                )}

                {/* Delivery / Pickup Toggle (hide for mesa) */}
                {tipoPedido !== 'mesa' && (
                    <div className="checkout-toggle">
                        <button
                            className={`checkout-toggle__btn ${tipoPedido === 'entrega' ? 'checkout-toggle__btn--active' : ''}`}
                            onClick={() => setTipoPedido('entrega')}
                        >
                            <span>🛵</span> Entrega
                        </button>
                        <button
                            className={`checkout-toggle__btn ${tipoPedido === 'retirada' ? 'checkout-toggle__btn--active' : ''}`}
                            onClick={() => setTipoPedido('retirada')}
                        >
                            <span>🏪</span> Retirada
                        </button>
                    </div>
                )}

                {/* Pickup / Mesa Name */}
                {(tipoPedido === 'retirada' || tipoPedido === 'mesa') && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <User size={20} color="var(--cor-primaria)" /> {tipoPedido === 'mesa' ? 'Qual é o seu nome?' : 'Quem vai retirar?'}
                        </h2>
                        <div className="checkout-card">
                            <div className="checkout-field">
                                <input
                                    type="text"
                                    placeholder="Digite seu nome (opcional)"
                                    value={nomeRetirada}
                                    onChange={e => setNomeRetirada(e.target.value)}
                                    className="checkout-input"
                                />
                            </div>
                        </div>
                    </section>
                )}

                {/* Delivery Address Review (read-only, from localStorage) */}
                {tipoPedido === 'entrega' && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <MapPin size={20} color="var(--cor-primaria)" /> Entregar em
                        </h2>
                        {hasAddress ? (
                            <div className="checkout-address-card">
                                <div className="checkout-address-card__info">
                                    <p className="checkout-address-card__street">
                                        {addressData.rua}, {addressData.numero}
                                    </p>
                                    <p className="checkout-address-card__neighborhood">
                                        {addressData.bairro}
                                    </p>
                                    {addressData.referencia && (
                                        <p className="checkout-address-card__ref">
                                            📍 {addressData.referencia}
                                        </p>
                                    )}
                                    <div className="checkout-address-card__receiver">
                                        <div className="checkout-address-card__receiver-group">
                                            <div className="checkout-address-card__receiver-item">
                                                <span className="receiver-item-icon"><User size={14} /></span>
                                                <span className="receiver-item-text">{addressData.nome_recebedor}</span>
                                            </div>
                                            <div className="checkout-address-card__receiver-item">
                                                <span className="receiver-item-icon" style={{ fontSize: '14px' }}>📱</span>
                                                <span className="receiver-item-text">{addressData.telefone_recebedor.replace(/@s.whatsapp.net/g, '')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="checkout-address-card__edit"
                                    onClick={() => navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')}
                                >
                                    <Edit3 size={16} />
                                    Editar
                                </button>
                            </div>
                        ) : (
                            <div className="checkout-address-empty" onClick={() => navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')}>
                                <MapPin size={24} />
                                <p>Nenhum endereço cadastrado</p>
                                <span>Toque para adicionar</span>
                            </div>
                        )}
                    </section>
                )}

                {/* Payment Method (hide for mesa - payment is at the table) */}
                {tipoPedido !== 'mesa' && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <CreditCard size={20} color="var(--cor-primaria)" /> Forma de Pagamento
                        </h2>
                        <div className="checkout-card">
                            <div className="checkout-payment-options">
                                <label className={`checkout-payment ${formaPagamento === 'pix' ? 'checkout-payment--active' : ''}`}>
                                    <input type="radio" name="pagamento" checked={formaPagamento === 'pix'} onChange={() => setFormaPagamento('pix')} />
                                    <span>💠 PIX</span>
                                </label>
                                <label className={`checkout-payment ${formaPagamento === 'cartao_entrega' ? 'checkout-payment--active' : ''}`}>
                                    <input type="radio" name="pagamento" checked={formaPagamento === 'cartao_entrega'} onChange={() => setFormaPagamento('cartao_entrega')} />
                                    <span>💳 Cartão (Entrega)</span>
                                </label>
                                <label className={`checkout-payment ${formaPagamento === 'dinheiro' ? 'checkout-payment--active' : ''}`}>
                                    <input type="radio" name="pagamento" checked={formaPagamento === 'dinheiro'} onChange={() => setFormaPagamento('dinheiro')} />
                                    <span>💵 Dinheiro</span>
                                </label>
                            </div>
                            {formaPagamento === 'dinheiro' && (
                                <div className="checkout-change">
                                    <label className="checkout-change__check">
                                        <input type="checkbox" checked={precisaTroco} onChange={e => setPrecisaTroco(e.target.checked)} />
                                        <span>Precisa de troco?</span>
                                    </label>
                                    {precisaTroco && (
                                        <input type="text" placeholder="Troco para quanto?" value={trocoPara} onChange={e => setTrocoPara(e.target.value)} className="checkout-change__input" />
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Order Summary */}
                <section className="checkout-section">
                    <h2 className="checkout-section__title">
                        <Receipt size={20} color="var(--cor-primaria)" /> Resumo do Pedido
                    </h2>
                    <div className="checkout-card">
                        <div className="checkout-items">
                            {items.map(item => {
                                const key = `${item.produto_id}-${item.variacao_id || 'default'}-${item.observacoes || ''}`
                                return (
                                    <div key={key} className="checkout-item">
                                        <div className="checkout-item__img">
                                            <img src={getImageUrl(item.imagem_url) || 'https://via.placeholder.com/60?text=🍖'} alt={item.nome} />
                                        </div>
                                        <div className="checkout-item__info">
                                            <div className="checkout-item__top">
                                                <h4>{item.nome}</h4>
                                                <span>{formatCurrency(item.preco * item.quantidade)}</span>
                                            </div>
                                            {item.personalizacao && typeof item.personalizacao === 'object' && (() => {
                                                const filtered = filterPersonalizacao(item.personalizacao, item.nome)
                                                return filtered.length > 0 && (
                                                    <div className="checkout-item__details">
                                                        {filtered.map(({ key, value }) => (
                                                            <p key={key} className="checkout-item__detail">
                                                                <strong>{key}:</strong> {value}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )
                                            })()}

                                            {item.observacoes && (
                                                <p className="checkout-item__obs" style={{ color: 'var(--cor-destaque)', fontWeight: '500' }}>
                                                    OBS: {item.observacoes}
                                                </p>
                                            )}
                                            {!item.observacoes && item.descricao && (
                                                <p className="checkout-item__desc">{item.descricao}</p>
                                            )}
                                            <span className="checkout-item__qty">{item.quantidade}x</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="checkout-totals">
                            <div className="checkout-totals__row">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {tipoPedido === 'entrega' && (
                                <div className="checkout-totals__row">
                                    <span>Taxa de Entrega</span>
                                    <span>{formatCurrency(taxaEntrega)}</span>
                                </div>
                            )}
                            <div className="checkout-totals__total">
                                <span>Total</span>
                                <span className="checkout-totals__value">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* CTA */}
            <div className="checkout-footer">
                <button
                    className="checkout-footer__btn"
                    onClick={handleConfirm}
                    disabled={loading || isSubmitting || (tipoPedido === 'entrega' && !hasAddress) || (tipoPedido === 'retirada' && !nomeRetirada.trim()) || (tipoPedido === 'mesa' && !mesaId)}
                >
                    {loading || isSubmitting ? (
                        <span className="btn-spinner" />
                    ) : (
                        <>
                            <CheckCircle size={18} style={{ marginRight: 8 }} />
                            Confirmar Pedido {formatCurrency(total)}
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
