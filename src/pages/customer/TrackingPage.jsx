import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Phone, MessageSquare, Headphones } from 'lucide-react'
import { useOrderTracking } from '../../hooks/useOrders'
import Loading from '../../components/ui/Loading'
import { getStatusLabel, getStatusColor } from '../../lib/utils'
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
    const { id } = useParams()
    const navigate = useNavigate()
    const { order, loading } = useOrderTracking(id)

    if (loading) return <Loading fullScreen text="Carregando pedido..." />
    if (!order) return <div style={{ padding: 40, textAlign: 'center' }}>Pedido não encontrado</div>

    const currentIndex = STATUS_INDEX[order.status] ?? 0
    const progress = Math.min(((currentIndex + 1) / STEPS.length) * 100, 100)
    const isCancelled = order.status === 'cancelado'

    return (
        <div className="tracking-page animate-fade-in">
            {/* Header */}
            <header className="tracking-header">
                <button className="tracking-header__btn" onClick={() => navigate('/')}>
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
                    <p className="tracking-time-card__label">Tempo estimado de entrega</p>
                    <h2 className="tracking-time-card__value">
                        25-35 <span>min</span>
                    </h2>
                    <div className="tracking-time-card__status">
                        <span className="tracking-time-card__dot" />
                        <span>{getStatusLabel(order.status)}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="tracking-progress">
                        <div className="tracking-progress__fill" style={{ width: `${progress}%` }}>
                            <div className="tracking-progress__indicator" />
                        </div>
                    </div>
                </div>

                {/* Order Number */}
                <div className="tracking-order-bar">
                    <div>
                        <span className="tracking-order-bar__label">Pedido Nº</span>
                        <span className="tracking-order-bar__number">#{order.numero_pedido || order.id.slice(0, 4)}</span>
                    </div>
                    <a href="#" className="tracking-order-bar__link">Ver detalhes</a>
                </div>

                {/* Timeline */}
                <div className="tracking-timeline-card">
                    <div className="tracking-timeline">
                        {STEPS.map((step, i) => {
                            const completed = i < currentIndex
                            const active = i === currentIndex
                            const future = i > currentIndex

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
                                            {step.label}
                                        </h3>
                                        <p className="tracking-step__desc">{step.desc}</p>
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
                    <Link to="/" className="tracking-promo__btn">Ver Menu</Link>
                </div>
            </main>
        </div>
    )
}
