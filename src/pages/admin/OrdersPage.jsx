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
    { id: 'confirmado', label: 'Novos', icon: AlertCircle, color: '#FBBF24', next: 'pronto', nextLabel: 'Iniciar Preparo' },
    { id: 'pronto', label: 'Em Preparação', icon: Utensils, color: '#8B5CF6', next: 'entrega', nextLabel: 'Entregador a caminho' },
    { id: 'entrega', label: 'Em Entrega', icon: Bike, color: '#F59E0B', next: 'entregue', nextLabel: 'Entregue / Finalizar' },
    { id: 'entregue', label: 'Concluídos', icon: CheckCircle2, color: '#10B981' }
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    setOrders(prev => prev.map(order =>
                        order.id === payload.new.id ? { ...order, ...payload.new } : order
                    ))
                } else if (payload.eventType === 'INSERT') {
                    // For new orders, we might still need a fetch to get joined relations (itens)
                    // but we can prepend the new order optimistically if payload has enough info
                    fetchOrders()
                } else if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(order => order.id !== payload.old.id))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    async function fetchOrders() {
        setLoading(true)

        // Get current time in Brasília (UTC-3)
        const nowInBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const todayBR = new Date(nowInBR)
        todayBR.setHours(0, 0, 0, 0)

        // Convert Brasília midnight back to UTC for Supabase query
        // Since BR is UTC-3, midnight BR is 03:00 UTC
        const todayUTC = new Date(todayBR.getTime() - (todayBR.getTimezoneOffset() * 60000))
        // More reliably, since we know it's BR (UTC-3):
        const brMidnightAsUTC = new Date(todayBR)
        // Set to 3am UTC to represent midnight BR
        brMidnightAsUTC.setUTCHours(3, 0, 0, 0)

        const { data, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                itens:itens_pedido(
                    *,
                    produtos(nome)
                )
            `)
            .gte('criado_em', brMidnightAsUTC.toISOString())
            .order('criado_em', { ascending: false })

        if (!error) {
            setOrders(data || [])
        }
        setLoading(false)
    }

    const handleStatusChange = async (orderId, newStatus) => {
        // 1. Optimistic Update
        const previousOrders = [...orders]
        const now = new Date().toISOString()

        setOrders(prev => prev.map(order =>
            order.id === orderId ? {
                ...order,
                status: newStatus,
                confirmado_em: newStatus === 'pronto' ? now : order.confirmado_em,
                entregue_em: newStatus === 'concluido' ? now : order.entregue_em
            } : order
        ))

        try {
            const updateData = { status: newStatus }
            if (newStatus === 'pronto') updateData.confirmado_em = now
            if (newStatus === 'entregue') updateData.entregue_em = now

            const { error } = await supabase
                .from('pedidos')
                .update(updateData)
                .eq('id', orderId)

            if (error) throw error
        } catch (error) {
            console.error('Erro ao atualizar status:', error)
            // 2. Rollback on Error
            setOrders(previousOrders)
            alert('Erro ao atualizar status do pedido. Tente novamente.')
        }
    }

    const onDragStart = (e, orderId) => {
        e.dataTransfer.setData('orderId', orderId)
        e.currentTarget.classList.add('dragging')
    }

    const onDragEnd = (e) => {
        e.currentTarget.classList.remove('dragging')
    }

    const onDragOver = (e) => {
        e.preventDefault()
        e.currentTarget.classList.add('drag-over')
    }

    const onDragLeave = (e) => {
        e.currentTarget.classList.remove('drag-over')
    }

    const onDrop = (e, targetStage) => {
        e.preventDefault()
        e.currentTarget.classList.remove('drag-over')
        const orderId = e.dataTransfer.getData('orderId')
        if (orderId) {
            handleStatusChange(orderId, getStageStatus(targetStage))
        }
    }

    const getMinutesAgo = (date) => {
        if (!date) return 0
        const diff = new Date() - new Date(date)
        return Math.floor(diff / 60000)
    }

    const getStatusStage = (status) => {
        return status
    }

    const getStageStatus = (stageId) => {
        return stageId
    }

    const filteredOrders = orders.filter(order => {
        const matchesStatus = (stageId) => getStatusStage(order.status) === stageId
        const matchesSearch = !searchTerm ||
            order.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.numero_pedido?.toString().includes(searchTerm) ||
            order.itens?.some(item => item.produtos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()))

        return matchesSearch
    })

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
                <div className="kanban-board">
                    {STAGES.map(stage => {
                        const stageOrders = filteredOrders.filter(o => getStatusStage(o.status) === stage.id)

                        return (
                            <div
                                key={stage.id}
                                className="kanban-col"
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={(e) => onDrop(e, stage.id)}
                            >
                                <div className="col-header" style={{ borderTop: `4px solid ${stage.color}` }}>
                                    <div className="header-label">
                                        <stage.icon size={18} color={stage.color} />
                                        <h3>{stage.label}</h3>
                                    </div>
                                    <span className="order-count">{stageOrders.length}</span>
                                </div>

                                <div className="cards-stack">
                                    {stageOrders.map(order => (
                                        <div
                                            key={order.id}
                                            draggable
                                            onDragStart={(e) => onDragStart(e, order.id)}
                                            onDragEnd={onDragEnd}
                                            className={`order-card-v2 cursor-grab ${stage.id === 'pronto' ? 'border-purple' : stage.id === 'entrega' ? 'border-orange' : stage.id === 'entregue' ? 'border-green' : ''}`}
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
                                                <div className="avatar-circle" style={{ backgroundColor: stage.color + '15', color: stage.color }}>
                                                    {(order.nome_cliente || 'Cliente').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="customer-info">
                                                    <h4>{order.nome_cliente || 'Sem nome'}</h4>
                                                    <span className="item-count-badge">
                                                        {order.itens?.reduce((acc, i) => acc + i.quantidade, 0)} itens
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="items-preview">
                                                {order.itens?.map((item, idx) => (
                                                    <div key={idx} className="item-detail-row">
                                                        <div className="item-main">
                                                            <span className="qnt">{item.quantidade}x</span>
                                                            <span className="name">{item.produtos?.nome}</span>
                                                        </div>
                                                        {(item.observacoes || item.personalizacao) && (
                                                            <div className="item-addons">
                                                                {item.observacoes && <p className="notes">{item.observacoes}</p>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {order.endereco && (
                                                <div className="address-preview">
                                                    <MapPin size={12} />
                                                    <span>
                                                        {typeof order.endereco === 'string'
                                                            ? order.endereco
                                                            : `${order.endereco.street}, ${order.endereco.number} - ${order.endereco.neighborhood}`}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="card-footer-v2">
                                                <div className="time-ago">
                                                    <Timer size={14} />
                                                    <span>{getMinutesAgo(order.criado_em)}m</span>
                                                </div>
                                                <span className="price">{formatCurrency(order.valor_total)}</span>
                                            </div>

                                            {stage.next && (
                                                <button
                                                    className={`quick-action stage-${stage.next}`}
                                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, stage.next); }}
                                                >
                                                    {stage.nextLabel}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
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
                                    <div key={idx} className="item-line-container">
                                        <div className="item-line">
                                            <span>{item.quantidade}x {item.produtos?.nome}</span>
                                            <span>{formatCurrency(item.preco_unitario * item.quantidade)}</span>
                                        </div>
                                        {item.observacoes && (
                                            <p className="item-obs-modal">{item.observacoes}</p>
                                        )}
                                    </div>
                                ))}
                                <div className="total-line">
                                    <strong>Total</strong>
                                    <strong>{formatCurrency(selectedOrder.valor_total)}</strong>
                                </div>
                            </div>

                            {selectedOrder.endereco && (
                                <div className="modal-address-box">
                                    <div className="address-header">
                                        <MapPin size={16} />
                                        <strong>Endereço de Entrega</strong>
                                    </div>
                                    <p>
                                        {typeof selectedOrder.endereco === 'string'
                                            ? selectedOrder.endereco
                                            : `${selectedOrder.endereco.street}, ${selectedOrder.endereco.number} - ${selectedOrder.endereco.neighborhood}`}
                                    </p>
                                    {selectedOrder.endereco.reference && (
                                        <p className="address-ref">📍 {selectedOrder.endereco.reference}</p>
                                    )}
                                </div>
                            )}

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


