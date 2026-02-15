import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard, Receipt, Edit3, CheckCircle, User } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useOrders } from '../../hooks/useOrders'
import { useCustomer } from '../../context/CustomerContext'
import { formatCurrency, getImageUrl } from '../../lib/utils'
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
    const tipoPedido = localStorage.getItem('espetinho_tipo_pedido') || 'entrega'

    // Address Data
    const [addressData] = useState(() => {
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
                    telefone_recebedor: data.telefone_recebedor || data.receiverPhone || ''
                }
            } catch { }
        }
        return {}
    })

    // Fetch Neighborhood Fee
    const [taxaEntrega, setTaxaEntrega] = useState(0)

    useEffect(() => {
        async function fetchFee() {
            if (tipoPedido === 'retirada' || !addressData.bairro) {
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
    }, [tipoPedido, addressData.neighborhood])

    const total = subtotal + taxaEntrega

    const [savedData, setSavedData] = useState(() => {
        const raw = localStorage.getItem('espetinho_delivery_data')
        if (raw) {
            try {
                const data = JSON.parse(raw)
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
        return null
    })

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
            const hasNoLocal = !currentLocal
            const noManual = !localStorage.getItem('espetinho_manual_address')

            if (dbAddr.rua || dados.nome_recebedor) {
                if (hasNoLocal || noManual) {
                    const newData = {
                        nome_recebedor: dados.nome_recebedor || dados.receiverName || dados.nome || customer.nome || '',
                        telefone_recebedor: dados.telefone_recebedor || dados.receiverPhone || dados.whatsapp || customer.telefone || '',
                        rua: dbAddr.rua || dbAddr.street || dbAddr.logradouro || '',
                        numero: dbAddr.numero || dbAddr.number || '',
                        bairro: dbAddr.bairro || dbAddr.neighborhood || '',
                        referencia: dbAddr.referencia || dbAddr.reference || dbAddr.ponto_referencia || ''
                    }

                    const isDifferent = JSON.stringify(newData) !== JSON.stringify(savedData)
                    if (isDifferent) {
                        localStorage.setItem('espetinho_delivery_data', JSON.stringify(newData))
                        setSavedData(newData)
                    }
                }
            }
        }
    }, [customer])

    const enderecoCompleto = savedData
        ? `${savedData.rua}, ${savedData.numero} - ${savedData.bairro}${savedData.referencia ? ` (${savedData.referencia})` : ''}`
        : null

    const hasAddress = !!(savedData && savedData.rua && savedData.nome_recebedor && savedData.telefone_recebedor)

    async function handleConfirm() {
        if (tipoPedido === 'entrega' && !hasAddress) {
            alert('Volte ao carrinho e preencha o endereço de entrega.')
            return
        }

        if (isSubmitting) return
        setIsSubmitting(true)

        try {
            const orderData = {
                nome_cliente: tipoPedido === 'retirada' ? nomeRetirada : (savedData?.nome_recebedor || ''),
                telefone_cliente: savedData?.telefone_recebedor || '',
                tipo_pedido: tipoPedido,
                subtotal,
                taxa_entrega: taxaEntrega,
                valor_total: total,
                forma_pagamento: formaPagamento,
                metodo_pagamento: formaPagamento, // Extra field for compatibility
                troco_para: precisaTroco ? parseFloat(trocoPara) : null,
                endereco: tipoPedido === 'entrega' ? savedData : null,
                observacoes,
                itens: items,
                cliente_id: customer?.id || null // Link the order to the customer!
            }

            const pedido = await createOrder(orderData)
            const targetClientId = pedido.cliente_id || customer?.id

            if (targetClientId) {
                const summary = items.map(i => `${i.quantidade}x ${i.nome}`).join(', ')
                await updateLastOrder(
                    `Pedido #${pedido.numero_pedido || pedido.id.slice(0, 5)}: ${summary}`,
                    tipoPedido === 'entrega' ? savedData : null,
                    targetClientId,
                    { nome: orderData.nome_cliente, telefone: orderData.telefone_cliente }
                )
            }

            // Webhook notification
            try {
                await fetch('https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/pedido_feito', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...orderData,
                        pedido_id: pedido.id,
                        numero_pedido: pedido.numero_pedido,
                        cliente_original: customer
                    })
                })
            } catch (webhookErr) {
                console.error('Erro ao enviar webhook:', webhookErr)
                // Don't block the user if webhook fails
            }

            clearCart()
            navigate(`/pedido/${pedido.id}`)
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
                <button className="btn btn-primary btn-md" onClick={() => navigate('/')}>
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
                {/* Delivery / Pickup Toggle */}
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

                {/* Pickup Name */}
                {tipoPedido === 'retirada' && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <User size={20} color="var(--cor-primaria)" /> Quem vai retirar?
                        </h2>
                        <div className="checkout-card">
                            <div className="checkout-field">
                                <input
                                    type="text"
                                    placeholder="Nome de quem vai buscar"
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
                                        {savedData.rua}, {savedData.numero}
                                    </p>
                                    <p className="checkout-address-card__neighborhood">
                                        {savedData.bairro}
                                    </p>
                                    {savedData.referencia && (
                                        <p className="checkout-address-card__ref">
                                            📍 {savedData.referencia}
                                        </p>
                                    )}
                                    <div className="checkout-address-card__receiver">
                                        <span>👤 {savedData.nome_recebedor}</span>
                                        <span>📱 {savedData.telefone_recebedor}</span>
                                    </div>
                                </div>
                                <button
                                    className="checkout-address-card__edit"
                                    onClick={() => navigate('/carrinho')}
                                >
                                    <Edit3 size={16} />
                                    Editar
                                </button>
                            </div>
                        ) : (
                            <div className="checkout-address-empty" onClick={() => navigate('/carrinho')}>
                                <MapPin size={24} />
                                <p>Nenhum endereço cadastrado</p>
                                <span>Toque para adicionar</span>
                            </div>
                        )}
                    </section>
                )}

                {/* Payment Method */}
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
                                            {item.observacoes ? (
                                                <p className="checkout-item__desc" style={{ color: 'var(--cor-destaque)', fontWeight: '500' }}>
                                                    {item.observacoes}
                                                </p>
                                            ) : item.descricao && (
                                                <p className="checkout-item__desc">{item.descricao}</p>
                                            )}
                                            <span className="checkout-item__qty">{item.quantidade}x</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Observations */}
                        <div className="checkout-field" style={{ marginTop: 16 }}>
                            <label>Observações do pedido</label>
                            <textarea placeholder="Ex: Carne bem passada, sem cebola..." rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
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
                    disabled={loading || isSubmitting || (tipoPedido === 'entrega' && !hasAddress) || (tipoPedido === 'retirada' && !nomeRetirada.trim())}
                >
                    {loading || isSubmitting ? (
                        <span className="btn-spinner" />
                    ) : (
                        <>
                            <span><CheckCircle size={18} style={{ marginRight: 8 }} />Confirmar Pedido</span>
                            <span>{formatCurrency(total)}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
