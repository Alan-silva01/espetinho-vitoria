import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useDriverAuth } from '../../hooks/useDriverAuth'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import {
    Bike, LogOut, CheckCircle2, DollarSign,
    MapPin, Phone, Info, Clock,
    Smartphone, Search, Wallet, CreditCard
} from 'lucide-react'
import './DriverDashboard.css'

export default function DriverDashboard() {
    const { driver, logout, loading: authLoading } = useDriverAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [paymentModal, setPaymentModal] = useState({ open: false, orderId: null })
    const [receivedValor, setReceivedValor] = useState('')
    const [savingPayment, setSavingPayment] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        if (driver?.id) {
            fetchDriverOrders()

            const channel = supabase
                .channel('driver_orders')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'pedidos', filter: 'tipo_pedido=eq.entrega' },
                    () => fetchDriverOrders()
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [driver])

    async function fetchDriverOrders() {
        if (!driver?.id) return

        const today = new Date()
        const brDateStr = today.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' })
        const [month, day, year] = brDateStr.split('/')
        const brMidnightAsUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0))

        const { data, error } = await supabase
            .from('pedidos')
            .select('*')
            .eq('tipo_pedido', 'entrega')
            .gte('criado_em', brMidnightAsUTC.toISOString())
            .order('criado_em', { ascending: false })

        if (!error) {
            setOrders(data || [])
        }
        setLoading(false)
    }

    const handleFinishDelivery = (order) => {
        setReceivedValor(order.valor_total.toString())
        setPaymentModal({ open: false, orderId: order.id }) // Reset first
        setPaymentModal({ open: true, orderId: order.id })
    }

    const confirmPayment = async (metodo) => {
        setSavingPayment(true)
        try {
            const { error } = await supabase
                .from('pedidos')
                .update({
                    status: 'entregue',
                    entregue_em: new Date().toISOString(),
                    entregador_id: driver.id, // Vincula o entregador que concluiu
                    recebido_por_status: true,
                    recebido_valor: Number(receivedValor),
                    recebido_metodo: metodo,
                    recebido_em: new Date().toISOString()
                })
                .eq('id', paymentModal.orderId)

            if (error) throw error

            setPaymentModal({ open: false, orderId: null })
            await fetchDriverOrders()
        } catch (err) {
            alert('Erro ao finalizar pedido: ' + err.message)
        } finally {
            setSavingPayment(false)
        }
    }

    if (authLoading) return <div className="driver-loading">Carregando...</div>
    if (!driver) return <Navigate to="/entregador/login" replace />

    const pendingOrders = orders.filter(o => o.status === 'saiu_entrega')
    const completedOrders = orders.filter(o => o.status === 'entregue')

    return (
        <div className="driver-dashboard-container">
            <header className="driver-app-header">
                <div className="driver-profile-mini">
                    <div className="driver-avatar">
                        <Bike size={20} />
                    </div>
                    <div>
                        <span className="welcome">Olá,</span>
                        <h2 className="driver-name">{driver.nome.split(' ')[0]}</h2>
                    </div>
                </div>
                <button className="btn-logout-mini" onClick={logout}>
                    <LogOut size={18} />
                </button>
            </header>

            <main className="driver-app-main">
                <div className="kanban-section">
                    <div className="section-title">
                        <Smartphone size={18} />
                        <h3>Para Entregar</h3>
                        <span className="count-pill">{pendingOrders.length}</span>
                    </div>

                    <div className="orders-list-mobile">
                        {pendingOrders.length > 0 ? pendingOrders.map(order => (
                            <div key={order.id} className="driver-order-card" onClick={() => setSelectedOrder(order)}>
                                <div className="card-header">
                                    <span className="order-number">#{order.numero_pedido}</span>
                                    <span className="order-time">{new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>

                                <div className="customer-info">
                                    <h4>{order.nome_cliente}</h4>
                                    <div className="address-row">
                                        <MapPin size={14} />
                                        <span>
                                            {typeof order.endereco === 'string'
                                                ? order.endereco
                                                : `${order.endereco.rua}, ${order.endereco.numero} - ${order.endereco.bairro}`}
                                        </span>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <div className="total-price">
                                        <span>Valor:</span>
                                        <strong>{formatCurrency(order.valor_total)}</strong>
                                    </div>
                                    <button
                                        className="btn-finish-delivery"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleFinishDelivery(order)
                                        }}
                                    >
                                        <CheckCircle2 size={18} />
                                        <span>Entregar</span>
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-state">
                                <Bike size={32} />
                                <p>Nenhum pedido para entregar no momento.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="kanban-section completed">
                    <div className="section-title">
                        <CheckCircle2 size={18} />
                        <h3>Concluídos Hoje</h3>
                        <span className="count-pill">{completedOrders.length}</span>
                    </div>

                    <div className="orders-list-mobile">
                        {completedOrders.map(order => (
                            <div key={order.id} className="driver-order-card finished">
                                <div className="card-header">
                                    <span className="order-number">#{order.numero_pedido}</span>
                                    <span className="payment-tag">{order.recebido_metodo?.toUpperCase()}</span>
                                </div>
                                <div className="customer-info">
                                    <h4>{order.nome_cliente}</h4>
                                    <p className="finish-time">Entregue às {new Date(order.entregue_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="card-footer">
                                    <span className="total">{formatCurrency(order.valor_total)}</span>
                                    <div className="status-badge">
                                        <CheckCircle2 size={12} />
                                        Concluído
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Modal de Pagamento */}
            {paymentModal.open && (
                <div className="driver-modal-overlay">
                    <div className="payment-modal animate-slide-up">
                        <h3>Confirmar Recebimento</h3>
                        <p>Escolha a forma que o cliente pagou:</p>

                        <div className="value-preview">
                            <label>Valor Recebido</label>
                            <div className="input-money">
                                <span>R$</span>
                                <input
                                    type="number"
                                    value={receivedValor}
                                    onChange={e => setReceivedValor(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="payment-options">
                            <button className="btn-pay pix" onClick={() => confirmPayment('pix')} disabled={savingPayment}>
                                <Smartphone size={24} />
                                <span>PIX</span>
                            </button>
                            <button className="btn-pay card" onClick={() => confirmPayment('cartao')} disabled={savingPayment}>
                                <CreditCard size={24} />
                                <span>CARTÃO</span>
                            </button>
                            <button className="btn-pay cash" onClick={() => confirmPayment('dinheiro')} disabled={savingPayment}>
                                <Wallet size={24} />
                                <span>DINHEIRO</span>
                            </button>
                        </div>

                        <button className="btn-close-modal" onClick={() => setPaymentModal({ open: false, orderId: null })}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Detalhes do Pedido Modal opcional */}
            {selectedOrder && (
                <div className="driver-modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="order-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="detail-header">
                            <h3>Pedido #{selectedOrder.numero_pedido}</h3>
                            <button onClick={() => setSelectedOrder(null)}>Fechar</button>
                        </div>
                        <div className="detail-body">
                            <div className="info-group">
                                <label>Cliente</label>
                                <strong>{selectedOrder.nome_cliente}</strong>
                                <p className="tel-line">
                                    <Phone size={14} />
                                    {selectedOrder.telefone_cliente}
                                </p>
                            </div>
                            <div className="info-group">
                                <label>Endereço</label>
                                <p>
                                    {typeof selectedOrder.endereco === 'string'
                                        ? selectedOrder.endereco
                                        : `${selectedOrder.endereco.rua}, ${selectedOrder.endereco.numero} - ${selectedOrder.endereco.bairro}`}
                                </p>
                                {selectedOrder.endereco?.referencia && (
                                    <p className="ref">Ref: {selectedOrder.endereco.referencia}</p>
                                )}
                            </div>
                            <div className="info-group">
                                <label>Observações</label>
                                <p>{selectedOrder.observacoes || 'Nenhuma'}</p>
                            </div>
                            <div className="order-items-mini">
                                <label>Itens</label>
                                {/* Itens seriam buscados ou passados, se houver muitos, simplificamos */}
                                <p>Ver resumo no card principal.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
