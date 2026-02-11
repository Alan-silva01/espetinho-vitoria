import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard, DollarSign, Receipt } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useOrders } from '../../hooks/useOrders'
import { formatCurrency, getImageUrl } from '../../lib/utils'
import './CheckoutPage.css'

export default function CheckoutPage() {
    const navigate = useNavigate()
    const { items, subtotal, clearCart } = useCart()
    const { createOrder, loading } = useOrders()

    const [tipoPedido, setTipoPedido] = useState('entrega')
    const [endereco, setEndereco] = useState({ rua: '', numero: '', bairro: '', complemento: '' })
    const [formaPagamento, setFormaPagamento] = useState('pix')
    const [precisaTroco, setPrecisaTroco] = useState(false)
    const [trocoPara, setTrocoPara] = useState('')
    const [observacoes, setObservacoes] = useState('')
    const [nomeCliente, setNomeCliente] = useState('')
    const [telefoneCliente, setTelefoneCliente] = useState('')

    const taxaEntrega = tipoPedido === 'entrega' ? 5.0 : 0
    const total = subtotal + taxaEntrega

    async function handleConfirm() {
        try {
            const pedido = await createOrder({
                nome_cliente: nomeCliente,
                telefone_cliente: telefoneCliente,
                tipo_pedido: tipoPedido,
                subtotal,
                taxa_entrega: taxaEntrega,
                valor_total: total,
                forma_pagamento: formaPagamento,
                troco_para: precisaTroco ? parseFloat(trocoPara) : null,
                endereco: tipoPedido === 'entrega'
                    ? `${endereco.rua}, ${endereco.numero} - ${endereco.bairro}${endereco.complemento ? ` (${endereco.complemento})` : ''}`
                    : null,
                observacoes,
                itens: items,
            })
            clearCart()
            navigate(`/pedido/${pedido.id}`)
        } catch (err) {
            alert('Erro ao confirmar pedido: ' + err.message)
        }
    }

    return (
        <div className="checkout-page animate-fade-in">
            {/* Header */}
            <header className="checkout-header">
                <button className="checkout-header__back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={22} />
                </button>
                <h1>Checkout</h1>
                <div style={{ width: 40 }} />
            </header>

            <main className="checkout-main">
                {/* Client Info */}
                <section className="checkout-section">
                    <h2 className="checkout-section__title">
                        <span>👤</span> Seus Dados
                    </h2>
                    <div className="checkout-card">
                        <div className="checkout-field">
                            <label>Nome</label>
                            <input type="text" placeholder="Seu nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                        </div>
                        <div className="checkout-field">
                            <label>Telefone (WhatsApp)</label>
                            <input type="tel" placeholder="(00) 00000-0000" value={telefoneCliente} onChange={e => setTelefoneCliente(e.target.value)} />
                        </div>
                    </div>
                </section>

                {/* Order Type Toggle */}
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

                {/* Delivery Address */}
                {tipoPedido === 'entrega' && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <MapPin size={20} color="var(--cor-primaria)" /> Endereço de Entrega
                        </h2>
                        <div className="checkout-card">
                            <div className="checkout-field-row">
                                <div className="checkout-field" style={{ flex: 1 }}>
                                    <label>Rua</label>
                                    <input type="text" value={endereco.rua} onChange={e => setEndereco({ ...endereco, rua: e.target.value })} />
                                </div>
                                <div className="checkout-field" style={{ width: 80 }}>
                                    <label>Número</label>
                                    <input type="text" value={endereco.numero} onChange={e => setEndereco({ ...endereco, numero: e.target.value })} style={{ textAlign: 'center' }} />
                                </div>
                            </div>
                            <div className="checkout-field">
                                <label>Bairro</label>
                                <input type="text" value={endereco.bairro} onChange={e => setEndereco({ ...endereco, bairro: e.target.value })} />
                            </div>
                            <div className="checkout-field">
                                <label>Complemento (Opcional)</label>
                                <input type="text" placeholder="Apto, Bloco, Referência" value={endereco.complemento} onChange={e => setEndereco({ ...endereco, complemento: e.target.value })} />
                            </div>
                        </div>
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
                    disabled={loading || !nomeCliente || !telefoneCliente}
                >
                    {loading ? (
                        <span className="btn-spinner" />
                    ) : (
                        <>
                            <span>Confirmar Pedido</span>
                            <span>{formatCurrency(total)}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
