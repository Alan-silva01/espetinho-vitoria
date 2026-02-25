import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Phone, MessageSquare, Headphones, ChevronDown, ChevronUp, Package, Plus, Receipt } from 'lucide-react'
import { useOrderTracking, useComanda, useOrders } from '../../hooks/useOrders'
import Loading from '../../components/ui/Loading'
import Dialog from '../../components/ui/Dialog'
import { getStatusLabel, formatCurrency, filterPersonalizacao, getSmartItemName } from '../../lib/utils'
import './TrackingPage.css'

const STEPS = [
    { key: 'pendente', label: 'Pedido recebido', desc: 'Confirmamos seu pedido' },
    { key: 'confirmado', label: 'Confirmado pelo restaurante', desc: 'Estamos começando!' },
    { key: 'preparando', label: 'Preparando', desc: 'Estamos preparando seus espetinhos com carinho.' },
    { key: 'pronto', label: 'Pronto', desc: 'Seu pedido já está pronto!' },
    { key: 'saiu_entrega', label: 'Saiu para entrega', desc: 'O entregador está a caminho.' },
    { key: 'entregue', label: 'Entregue', desc: 'Bom apetite!' },
]

const STATUS_INDEX = {
    pendente: 0, confirmado: 1, preparando: 2,
    pronto: 3, saiu_entrega: 4, entregue: 5, cancelado: -1,
}


export default function TrackingPage() {
    const { id, customerCode } = useParams()
    const navigate = useNavigate()
    const { order, loading: orderLoading } = useOrderTracking(id)
    const { orders: comandaOrders, total: comandaTotal, status: comandaStatus, loading: comandaLoading } = useComanda(order?.comanda_id)
    const { requestComandaClosing } = useOrders()
    const [showDetails, setShowDetails] = useState(false)
    const [requestingClose, setRequestingClose] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const loading = orderLoading || (order?.tipo_pedido === 'mesa' && comandaLoading)

    if (loading) return <Loading fullScreen text="Carregando pedido..." />
    if (!order) return <div style={{ padding: 40, textAlign: 'center' }}>Pedido não encontrado</div>

    const currentIndex = STATUS_INDEX[order.status] ?? 0
    const isMesa = order.tipo_pedido === 'mesa'

    // Custom steps for Mesa
    const mesaSteps = [
        { key: 'confirmado', label: 'Pedido recebido', desc: 'Já recebemos e vamos iniciar!' },
        { key: 'preparando', label: 'Preparando', desc: 'Estamos preparando seus espetinhos.' },
        { key: 'entregue', label: 'Pedido servido', desc: 'Bom apetite!' },
    ]

    const effectiveSteps = isMesa ? mesaSteps : STEPS

    // Mapping current status to effective step index for progress bar
    let effectiveIndex = currentIndex
    if (isMesa) {
        if (order.status === 'pendente' || order.status === 'confirmado') effectiveIndex = 0
        else if (order.status === 'preparando' || order.status === 'pronto') effectiveIndex = 1
        else if (order.status === 'entregue' || order.status === 'saiu_entrega') effectiveIndex = 2
    }

    const progress = Math.min(((effectiveIndex + 1) / effectiveSteps.length) * 100, 100)

    return (
        <div className="tracking-page animate-fade-in">
            {/* Header */}
            <header className="tracking-header">
                <button className="tracking-header__btn" onClick={() => navigate(customerCode ? `/${customerCode}` : '/')}>
                    <ArrowLeft size={22} />
                </button>
                <h1>Status do Pedido</h1>
                <button className="tracking-header__btn">
                    <Headphones size={22} />
                </button>
            </header>

            <main className="tracking-main">
                {/* Estimated Time Card */}
                <div className="tracking-time-card">
                    <div className="tracking-time-card__blur tracking-time-card__blur--purple" />
                    <div className="tracking-time-card__blur tracking-time-card__blur--red" />
                    <p className="tracking-time-card__label">
                        {isMesa ? 'Tempo de preparo' : 'Tempo estimado de entrega'}
                    </p>
                    <h2 className="tracking-time-card__value">
                        {isMesa ? '15-25' : '40-50'} <span>min</span>
                    </h2>
                    <div className="tracking-time-card__status">
                        <span className="tracking-time-card__dot" />
                        <span>{getStatusLabel(order.status, order.tipo_pedido)}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="tracking-progress">
                        <div className="tracking-progress__fill" style={{ width: `${progress}%` }}>
                            <div className="tracking-progress__indicator" />
                        </div>
                    </div>
                </div>

                {/* Comanda Summary (Mesa Only) - Only show if there are active orders */}
                {isMesa && order.comanda_id && comandaOrders.length > 0 && (
                    <div className="tracking-comanda-card animate-slide-down">
                        <div className="tracking-comanda-header">
                            <div className="tracking-comanda-header__info">
                                <Receipt size={20} color="var(--cor-primaria)" />
                                <div>
                                    <h3>Resumo da Mesa</h3>
                                    <span className={`tracking-comanda-status ${comandaStatus}`}>
                                        {comandaStatus === 'fechamento_solicitado' ? 'Aguardando Pagamento' :
                                            comandaStatus === 'paga' ? 'Pagamento Confirmado' : 'Conta Aberta'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="tracking-comanda-total">
                            <span className="tracking-comanda-total__label">Total Acumulado</span>
                            <div className="tracking-comanda-total__value">
                                <span>{formatCurrency(comandaTotal)}</span>
                                <small>{comandaOrders?.filter(o => !o.pago).length} pedidos ativos</small>
                            </div>
                        </div>

                        <div className="tracking-comanda-actions">
                            <button
                                className="btn-comanda btn-comanda--new"
                                onClick={() => navigate(customerCode ? `/${customerCode}` : '/')}
                                disabled={comandaStatus === 'paga'}
                            >
                                <Plus size={18} /> Pedir Mais
                            </button>

                            {comandaStatus === 'aberta' && (
                                <button
                                    className="btn-comanda btn-comanda--close"
                                    onClick={() => setIsDialogOpen(true)}
                                    disabled={requestingClose}
                                >
                                    {requestingClose ? 'Solicitando...' : 'Fechar Conta'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Order Number */}
                <div className="tracking-order-bar">
                    <div>
                        <span className="tracking-order-bar__label">Pedido Nº</span>
                        <span className="tracking-order-bar__number">#{order.numero_pedido || order.id.slice(0, 4)}</span>
                    </div>
                    <button
                        className={`tracking-order-bar__toggle ${showDetails ? 'is-active' : ''}`}
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
                        {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                {/* Detailed Items List */}
                {showDetails && (
                    <div className="tracking-items-overlay animate-slide-down">
                        <div className="tracking-items-list">
                            <div className="tracking-items-list__header">
                                <Package size={16} />
                                <span>Itens do Pedido</span>
                            </div>
                            {order.itens_pedido?.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="tracking-item-row"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="tracking-item-row__qty">
                                        {item.quantidade}x
                                    </div>
                                    <div className="tracking-item-row__info">
                                        <div className="tracking-item-row__name">
                                            {getSmartItemName(item.produtos?.nome, item.variacoes_produto?.nome, item.personalizacao)}
                                        </div>
                                        {(() => {
                                            const fullName = getSmartItemName(item.produtos?.nome, item.variacoes_produto?.nome, item.personalizacao)
                                            const filtered = filterPersonalizacao(item.personalizacao, fullName)
                                            return item.personalizacao && typeof item.personalizacao === 'object' && !Array.isArray(item.personalizacao) && filtered.length > 0 && (
                                                <div className="tracking-item-row__extras">
                                                    {filtered.map(({ key, value }) => (
                                                        <div key={key} className="tracking-item-row__extra-line">
                                                            <strong>{key}:</strong> {value}
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        })()}
                                        {item.observacoes && (
                                            <div className="tracking-item-row__obs">
                                                "{item.observacoes}"
                                            </div>
                                        )}
                                    </div>
                                    <div className="tracking-item-row__price">
                                        {getStatusLabel(order.status) === 'Cancelado' ? '-' : formatCurrency(item.preco_unitario * item.quantidade)}
                                    </div>
                                </div>
                            ))}
                            <div className="tracking-items-list__footer">
                                <div className="tracking-items-list__total-row">
                                    <span>Valor total:</span>
                                    <strong>{formatCurrency(order.valor_total)}</strong>
                                </div>
                                <div className="tracking-items-list__sub-info">
                                    <span>Pagamento: {order.forma_pagamento}</span>
                                    {order.troco_para && <span> • Troco p/ {formatCurrency(order.troco_para)}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Timeline */}
                <div className="tracking-timeline-card">
                    <div className="tracking-timeline">
                        {effectiveSteps.map((step, i) => {
                            const isDelivered = order.status === 'entregue' || (isMesa && order.status === 'saiu_entrega')
                            const completed = isDelivered ? true : i < effectiveIndex
                            const active = !isDelivered && i === effectiveIndex
                            const future = !isDelivered && i > effectiveIndex

                            // Custom labels for pickup
                            const isPickup = order.tipo_pedido === 'retirada'
                            let label = step.label
                            let desc = step.desc

                            if (isPickup && step.key === 'saiu_entrega') {
                                label = 'Pronto para Retirada'
                                desc = 'Seu pedido está pronto! Pode vir buscar.'
                            } else if (isPickup && step.key === 'pronto') {
                                label = 'Finalizando'
                                desc = 'Estamos embalando seu pedido.'
                            }

                            return (
                                <div key={step.key} className={`tracking-step ${future ? 'tracking-step--future' : ''}`}>
                                    <div className={`tracking-step__dot ${completed ? 'tracking-step__dot--done' :
                                        active ? 'tracking-step__dot--active' : ''
                                        }`}>
                                        {completed && <span>✓</span>}
                                        {active && <span className="tracking-step__spinner">↻</span>}
                                    </div>
                                    <div>
                                        <h3 className={`tracking-step__title ${active ? 'tracking-step__title--active' : ''}`}>
                                            {label}
                                        </h3>
                                        <p className="tracking-step__desc">{desc}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Driver Card */}
                {order.entregadores && (
                    <div className="tracking-driver">
                        <div className="tracking-driver__left">
                            <div className="tracking-driver__avatar">
                                <div className="tracking-driver__online" />
                            </div>
                            <div>
                                <h4 className="tracking-driver__name">{order.entregadores.nome}</h4>
                                <div className="tracking-driver__rating">
                                    <span>⭐</span> 4.9
                                </div>
                            </div>
                        </div>
                        <div className="tracking-driver__actions">
                            <button className="tracking-driver__btn">
                                <MessageSquare size={20} />
                            </button>
                            <button className="tracking-driver__btn tracking-driver__btn--primary"
                                onClick={() => window.open(`tel:${order.entregadores.telefone}`)}>
                                <Phone size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Promo Card */}
                <div className="tracking-promo">
                    <div className="tracking-promo__text">
                        <p className="tracking-promo__label">Próxima vez?</p>
                        <h3>Adicione um Caldo<br />ao seu pedido!</h3>
                    </div>
                    <Link to={customerCode ? `/${customerCode}` : '/'} className="tracking-promo__btn">Ver Menu</Link>
                </div>
            </main>

            {/* Confirmation Dialog */}
            <Dialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onConfirm={async () => {
                    setIsDialogOpen(false)
                    setRequestingClose(true)
                    try {
                        await requestComandaClosing(order.comanda_id)
                    } catch {
                        alert('Erro ao solicitar fechamento. Tente novamente.')
                    } finally {
                        setRequestingClose(false)
                    }
                }}
                title="Fechar Conta?"
                message="Deseja solicitar o fechamento da sua conta agora?"
            />
        </div>
    )
}
