import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, CheckCircle2, Clock, ChevronRight, Star } from 'lucide-react'
import { useCustomer } from '../../context/CustomerContext'
import { useCustomerOrders } from '../../hooks/useOrders'
import { formatCurrency, getStatusLabel } from '../../lib/utils'
import Loading from '../../components/ui/Loading'
import './OrdersListPage.css'

export default function OrdersListPage() {
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { customer, fetchCustomerByCode, loading: customerLoading } = useCustomer()
    const { orders, loading: ordersLoading } = useCustomerOrders(customer?.id)

    // Sync customer by code if provided in URL
    useEffect(() => {
        window.scrollTo(0, 0)
        if (customerCode && (!customer || customer.codigo !== customerCode)) {
            fetchCustomerByCode(customerCode)
        }
    }, [customerCode, customer, fetchCustomerByCode])

    const isLoading = customerLoading || ordersLoading

    if (isLoading) return <Loading fullScreen />

    return (
        <div className="orders-list-page animate-fade-in">
            <header className="orders-header">
                <button className="orders-header__back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={22} />
                </button>
                <h1>Seus pedidos</h1>
                <div style={{ width: 38 }} />
            </header>

            <div className="orders-container">
                {orders.length === 0 ? (
                    <div className="orders-empty">
                        <div className="orders-empty__icon">
                            <Package size={48} strokeWidth={1.5} />
                        </div>
                        <h2>Nenhum pedido ainda</h2>
                        <p>Seus pedidos aparecerão aqui após você fazer seu primeiro pedido!</p>
                        <button className="btn btn-primary btn-md" onClick={() => navigate('/')}>
                            Ver Cardápio
                        </button>
                    </div>
                ) : (
                    <div className="orders-grid">
                        {orders.map(order => (
                            <div key={order.id} className="order-card" onClick={() => navigate(`/pedido/${order.id}`)}>
                                <div className="order-card__main">
                                    <div className={`order-card__status-icon ${order.status === 'entregue' ? 'is-finished' : ''}`}>
                                        {order.status === 'entregue' ? (
                                            <CheckCircle2 size={24} />
                                        ) : (
                                            <Clock size={24} />
                                        )}
                                    </div>
                                    <div className="order-card__info">
                                        <div className="order-card__header">
                                            <div className="order-card__title-group">
                                                <h3>Pedido Nº {order.numero_pedido || order.id.toString().slice(-2)}</h3>
                                                <span className={`order-status-tag is-${order.status}`}>
                                                    {getStatusLabel(order.status, order.tipo_pedido)}
                                                </span>
                                            </div>
                                            <ChevronRight size={20} className="order-card__arrow" color="#999" />
                                        </div>
                                        <p className="order-card__date">
                                            Feito em {new Date(order.criado_em).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </p>
                                        <div className="order-card__meta">
                                            <span className="order-card__type">
                                                Tipo: <strong>{order.tipo_pedido === 'mesa' ? 'Mesa' : order.tipo_pedido === 'retirada' ? 'Retirada' : 'Delivery'}</strong>
                                            </span>
                                            <span className="order-card__total">
                                                Total: <strong>{formatCurrency(order.valor_total)}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
