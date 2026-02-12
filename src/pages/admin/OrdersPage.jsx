import { useState, useEffect } from 'react'
import {
    Clock, CheckCircle2, Truck, AlertCircle,
    MoreHorizontal, Phone, MapPin, DollarSign,
    User, ChevronRight, X, Utensils, Timer,
    Store, Bike, Play, Check, Calendar, Search, Bell
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './OrdersPage.css'

const STAGES = [
    { id: 'pendente', label: 'Pendente', icon: AlertCircle, color: '#FBBF24', countBg: '#F3F4F6' },
    { id: 'confirmado', label: 'Confirmado', icon: CheckCircle2, color: '#3B82F6', countBg: '#F3F4F6' },
    { id: 'preparando', label: 'Na Cozinha', icon: Utensils, color: '#8B5CF6', countBg: '#F3F4F6' },
    { id: 'pronto', label: 'Pronto', icon: Check, color: '#10B981', countBg: '#F3F4F6' },
    { id: 'entrega', label: 'Saiu p/ Entrega', icon: Bike, color: '#F59E0B', countBg: '#F3F4F6' }
]

export default function OrdersPage() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchOrders()

        const channel = supabase
            .channel('orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
                fetchOrders()
            })
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [])

    async function fetchOrders() {
        const { data } = await supabase
            .from('pedidos')
            .select(`
                *,
                itens:itens_pedido(
                    *,
                    produtos(nome)
                )
            `)
            .order('criado_em', { ascending: false })

        setOrders(data || [])
        setLoading(false)
    }

    async function updateStatus(id, newStatus) {
        await supabase.from('pedidos').update({ status: newStatus }).eq('id', id)
        fetchOrders()
    }

    const getMinutesAgo = (date) => {
        const diff = new Date() - new Date(date)
        return Math.floor(diff / 60000)
    }

    if (loading) return <div className="admin-loading">Carregando pedidos...</div>

    return (
        <div className="orders-kanban-wrapper animate-fade-in">
            <header className="orders-header-premium">
                <div className="header-left">
                    <h1>Gerenciamento de Pedidos</h1>
                    <div className="date-badge">
                        <Calendar size={14} />
                        <span>Hoje, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                    </div>
                </div>
                <div className="header-right">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar pedido, cliente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="icon-btn"><Bell size={20} /></button>
                </div>
            </header>

            <div className="kanban-scroller hide-scrollbar">
                <div className="kanban-board-premium">
                    {STAGES.map(stage => (
                        <div key={stage.id} className="kanban-col">
                            <div className="col-header">
                                <div className="title-row">
                                    <span className="dot" style={{ backgroundColor: stage.color }} />
                                    <h3>{stage.label}</h3>
                                    <span className="count-tag">{orders.filter(o => o.status === stage.id).length}</span>
                                </div>
                                <button className="more-btn"><MoreHorizontal size={18} /></button>
                            </div>

                            <div className="cards-stack">
                                {orders
                                    .filter(o => o.status === stage.id)
                                    .map(order => (
                                        <div
                                            key={order.id}
                                            className={`order-card-v2 cursor-pointer ${stage.id === 'preparando' ? 'border-purple' : stage.id === 'pronto' ? 'border-green' : ''}`}
                                            onClick={() => setSelectedOrder(order)}
                                        >
                                            <div className="card-top">
                                                <span className="order-id">#PED-{order.numero_pedido}</span>
                                                <span className={`type-tag ${order.tipo_pedido}`}>
                                                    {order.tipo_pedido === 'entrega' ? <Bike size={10} /> : <Store size={10} />}
                                                    {order.tipo_pedido}
                                                </span>
                                            </div>

                                            <div className="customer-row">
                                                <div className="avatar-circle">
                                                    {(order.nome_cliente || 'Cliente').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <h4>{order.nome_cliente || 'Sem nome'}</h4>
                                            </div>

                                            <div className="items-preview">
                                                {order.itens?.slice(0, 2).map((item, idx) => (
                                                    <p key={idx}>{item.quantidade}x {item.produtos?.nome}</p>
                                                ))}
                                                {order.itens?.length > 2 && <p className="more-items">+{order.itens.length - 2} itens...</p>}
                                            </div>

                                            {stage.id === 'preparando' && (
                                                <div className="progress-bar-small">
                                                    <div className="fill" style={{ width: '65%' }} />
                                                </div>
                                            )}

                                            <div className="card-footer">
                                                <div className="time-ago">
                                                    <Timer size={14} />
                                                    <span>{getMinutesAgo(order.criado_em)} min</span>
                                                </div>
                                                <span className="price">{formatCurrency(order.valor_total)}</span>
                                            </div>

                                            {stage.id === 'pendente' && (
                                                <button
                                                    className="quick-action confirm"
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'confirmado'); }}
                                                >
                                                    Confirmar
                                                </button>
                                            )}
                                            {stage.id === 'pronto' && (
                                                <button
                                                    className="quick-action dispatch"
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'entrega'); }}
                                                >
                                                    <CheckCircle2 size={14} /> Despachar
                                                </button>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal de Detalhes (Manter funcionalidade anterior, mas polir visual) */}
            {selectedOrder && (
                <div className="modal-overlay-v2" onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content-v2" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalhes do Pedido #{selectedOrder.numero_pedido}</h2>
                            <button onClick={() => setSelectedOrder(null)}><X size={24} /></button>
                        </div>
                        <div className="modal-body-v2">
                            {/* ... Content ... */}
                            <p><strong>Cliente:</strong> {selectedOrder.nome_cliente}</p>
                            <p><strong>Telefone:</strong> {selectedOrder.telefone_cliente}</p>
                            <div className="items-box">
                                {selectedOrder.itens?.map((item, idx) => (
                                    <div key={idx} className="item-line">
                                        <span>{item.quantidade}x {item.produtos?.nome}</span>
                                        <span>{formatCurrency(item.preco_unitario * item.quantidade)}</span>
                                    </div>
                                ))}
                                <div className="total-line">
                                    <strong>Total</strong>
                                    <strong>{formatCurrency(selectedOrder.valor_total)}</strong>
                                </div>
                            </div>
                            <div className="modal-actions-grid">
                                <button className="btn-print">Imprimir Cupom</button>
                                {selectedOrder.status === 'confirmado' && (
                                    <button className="btn-next" onClick={() => updateStatus(selectedOrder.id, 'preparando')}>Mandar p/ Cozinha</button>
                                )}
                                {selectedOrder.status === 'preparando' && (
                                    <button className="btn-next green" onClick={() => updateStatus(selectedOrder.id, 'pronto')}>Finalizar Preparo</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


