import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard, Receipt, Edit3, CheckCircle, User } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useOrders } from '../../hooks/useOrders'
import { useCustomer } from '../../context/CustomerContext'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import './CheckoutPage.css'

export default function CheckoutPage() {
    const navigate = useNavigate()
    const { items, subtotal, clearCart } = useCart()
    const { createOrder, loading } = useOrders()
    const { customer, updateLastOrder } = useCustomer()

    const [savedData, setSavedData] = useState(() => {
        const raw = localStorage.getItem('espetinho_delivery_data')
        if (raw) {
            try { return JSON.parse(raw) } catch { }
        }
        return null
    })

    const [tipoPedido, setTipoPedido] = useState('entrega')
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
            if (customer.dados?.endereco) {
                const currentLocal = localStorage.getItem('espetinho_delivery_data')
                const hasNoLocal = !currentLocal
                const noManual = !localStorage.getItem('espetinho_manual_address')

                if (hasNoLocal || noManual) {
                    const newData = {
                        receiverName: customer.dados.nome || customer.nome,
                        receiverPhone: customer.dados.whatsapp || customer.telefone,
                        ...customer.dados.endereco
                    }
                    localStorage.setItem('espetinho_delivery_data', JSON.stringify(newData))
                    setSavedData(newData)
                }
            }
        }
    }, [customer])

    const taxaEntrega = tipoPedido === 'entrega' ? 5.0 : 0
    const total = subtotal + taxaEntrega

    const enderecoCompleto = savedData
        ? `${savedData.street}, ${savedData.number} - ${savedData.neighborhood}${savedData.reference ? ` (${savedData.reference})` : ''}`
        : null

    const hasAddress = !!(savedData && savedData.street && savedData.receiverName && savedData.receiverPhone)

    async function handleConfirm() {
        if (tipoPedido === 'entrega' && !hasAddress) {
            alert('Volte ao carrinho e preencha o endereço de entrega.')
            return
        }

        try {
            const orderData = {
                nome_cliente: tipoPedido === 'retirada' ? nomeRetirada : (savedData?.receiverName || ''),
                telefone_cliente: savedData?.receiverPhone || '',
                tipo_pedido: tipoPedido,
                subtotal,
                taxa_entrega: taxaEntrega,
                valor_total: total,
                forma_pagamento: formaPagamento,
                troco_para: precisaTroco ? parseFloat(trocoPara) : null,
                endereco: tipoPedido === 'entrega' ? savedData : null,
                observacoes,
                itens: items,
                cliente_id: customer?.id || null // Link the order to the customer!
            }

            const pedido = await createOrder(orderData)

            // Update customer metadata (last order and address)
            if (customer) {
                const summary = items.map(i => `${i.quantidade}x ${i.nome}`).join(', ')
                await updateLastOrder(
                    `Pedido #${pedido.numero_pedido || pedido.id.slice(0, 5)}: ${summary}`,
                    tipoPedido === 'entrega' ? savedData : null
                )
            }

            clearCart()
            navigate(`/pedido/${pedido.id}`)
        } catch (err) {
            alert('Erro ao confirmar pedido: ' + err.message)
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
                <button className="checkout-header__back" onClick={() => navigate(-1)}>
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
                                        {savedData.street}, {savedData.number}
                                    </p>
                                    <p className="checkout-address-card__neighborhood">
                                        {savedData.neighborhood}
                                    </p>
                                    {savedData.reference && (
                                        <p className="checkout-address-card__ref">
                                            📍 {savedData.reference}
                                        </p>
                                    )}
                                    <div className="checkout-address-card__receiver">
                                        <span>👤 {savedData.receiverName}</span>
                                        <span>📱 {savedData.receiverPhone}</span>
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
                                <div className="checkout-payment__info">
                                    <span>💠 PIX</span>
                                    <span className="checkout-payment__discount">-5% OFF</span>
                                </div>
                            </label>
                            <label className={`checkout-payment ${formaPagamento === 'cartao' ? 'checkout-payment--active' : ''}`}>
                                <input type="radio" name="pagamento" checked={formaPagamento === 'cartao'} onChange={() => setFormaPagamento('cartao')} />
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
                                const key = `${item.produto_id}-${item.variacao_id || 'default'}`
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
                    disabled={loading || (tipoPedido === 'entrega' && !hasAddress) || (tipoPedido === 'retirada' && !nomeRetirada.trim())}
                >
                    {loading ? (
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
