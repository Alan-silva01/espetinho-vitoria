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
    { id: 'confirmado', label: 'Novos', icon: AlertCircle, color: '#FBBF24', next: 'preparando', nextLabel: 'Iniciar Preparo' },
    { id: 'preparando', label: 'Em Preparação', icon: Utensils, color: '#8B5CF6', next: 'saiu_entrega', nextLabel: 'Entregador a caminho' },
    { id: 'saiu_entrega', label: 'Em Entrega', icon: Bike, color: '#F59E0B', next: 'entregue', nextLabel: 'Entregue / Finalizar' },
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
        // Get Brasília date as string and parse it to avoid timezone offsets issues
        const brDateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' })
        const [month, day, year] = brDateStr.split('/')

        // This is Midnight in Brasília
        const todayBR = new Date(year, month - 1, day, 0, 0, 0)

        // Set to 3am UTC to represent midnight BR (UTC-3)
        const brMidnightAsUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0))

        console.log('[fetchOrders] Filtrando após:', brMidnightAsUTC.toISOString())

        const { data, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                itens:itens_pedido(
                    *,
                    produtos(nome)
                ),
                clientes(telefone, nome)
            `)
            .gte('criado_em', brMidnightAsUTC.toISOString())
            .order('criado_em', { ascending: true })

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
                confirmado_em: (newStatus === 'preparando' || newStatus === 'pronto') ? now : order.confirmado_em,
                entregue_em: newStatus === 'entregue' ? now : order.entregue_em
            } : order
        ))

        try {
            const updateData = { status: newStatus }
            if (newStatus === 'preparando' || newStatus === 'pronto') updateData.confirmado_em = now
            if (newStatus === 'entregue') updateData.entregue_em = now

            const { error } = await supabase
                .from('pedidos')
                .update(updateData)
                .eq('id', orderId)

            if (error) throw error

            // Webhook notification for "Saiu para Entrega"
            if (newStatus === 'saiu_entrega') {
                const order = orders.find(o => o.id === orderId)
                if (order) {
                    try {
                        await fetch('https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/saiu_entrega', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                order_id: order.id,
                                numero_pedido: order.numero_pedido,
                                status: newStatus,
                                tipo_pedido: order.tipo_pedido,
                                telefone_contato: order.telefone_cliente || order.clientes?.telefone,
                                cliente: {
                                    id: order.cliente_id,
                                    nome: order.clientes?.nome || order.nome_cliente,
                                    telefone_db: order.clientes?.telefone,
                                    whatsapp_contato: order.clientes?.whatsapp || order.telefone_cliente,
                                },
                                endereco: order.endereco,
                                valor_total: order.valor_total,
                                itens: order.itens?.map(item => ({
                                    quantidade: item.quantidade,
                                    nome: item.produtos?.nome,
                                    preco: item.preco_unitario,
                                    observacoes: item.observacoes
                                }))
                            })
                        })
                    } catch (webhookErr) {
                        console.error('Erro ao enviar webhook saiu_entrega:', webhookErr)
                    }
                }
            }
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
                                            className={`order-card-v2 ${(order.status === 'preparando' || order.status === 'pronto') ? 'border-purple' : order.status === 'saiu_entrega' ? 'border-orange' : order.status === 'entregue' ? 'border-green' : ''}`}
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
                                                            : `${order.endereco.rua || order.endereco.street}, ${order.endereco.numero || order.endereco.number} - ${order.endereco.bairro || order.endereco.neighborhood}`}
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

            {selectedOrder && (
                <div className="modal-overlay-v2 modal-active" onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content-premium" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-premium">
                            <div className="header-order-info">
                                <span className="order-number">Pedido #{selectedOrder.numero_pedido}</span>
                                <span className={`type-badge ${selectedOrder.tipo_pedido}`}>
                                    {selectedOrder.tipo_pedido === 'entrega' ? <Bike size={14} /> : <Store size={14} />}
                                    {selectedOrder.tipo_pedido === 'entrega' ? 'Para Entrega' : 'Para Retirada'}
                                </span>
                            </div>
                            <button className="close-modal" onClick={() => setSelectedOrder(null)}><X size={24} /></button>
                        </div>

                        <div className="modal-scroll-body hide-scrollbar">
                            {/* Customer Section */}
                            <section className="modal-section-v2">
                                <h3 className="section-title-v2"><User size={16} /> Dados do Cliente</h3>
                                <div className="customer-detail-card">
                                    <div className="detail-row">
                                        <span className="label">Nome:</span>
                                        <span className="value">{selectedOrder.nome_cliente || 'N/A'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Telefone:</span>
                                        <a href={`tel:${selectedOrder.telefone_cliente}`} className="value-link">
                                            <Phone size={14} /> {selectedOrder.telefone_cliente || 'N/A'}
                                        </a>
                                    </div>
                                </div>
                            </section>

                            {/* Address Section */}
                            {selectedOrder.tipo_pedido === 'entrega' && selectedOrder.endereco && (
                                <section className="modal-section-v2">
                                    <h3 className="section-title-v2"><MapPin size={16} /> Endereço de Entrega</h3>
                                    <div className="address-detail-card">
                                        <p className="address-main">
                                            {typeof selectedOrder.endereco === 'string'
                                                ? selectedOrder.endereco
                                                : `${selectedOrder.endereco.rua}, ${selectedOrder.endereco.numero}`}
                                        </p>
                                        {selectedOrder.endereco.bairro && (
                                            <p className="address-sub">{selectedOrder.endereco.bairro}</p>
                                        )}
                                        {selectedOrder.endereco.referencia && (
                                            <p className="address-ref">📍 Ref: {selectedOrder.endereco.referencia}</p>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Items Section */}
                            <section className="modal-section-v2">
                                <h3 className="section-title-v2"><Utensils size={16} /> Itens do Pedido</h3>
                                <div className="order-items-list-v2">
                                    {selectedOrder.itens?.map((item, idx) => (
                                        <div key={idx} className="order-item-v2">
                                            <div className="item-header-v2">
                                                <div className="item-info-v2">
                                                    <span className="item-qty-v2">{item.quantidade}x</span>
                                                    <span className="item-name-v2">{item.produtos?.nome}</span>
                                                </div>
                                                <span className="item-price-v2">{formatCurrency(item.preco_unitario * item.quantidade)}</span>
                                            </div>

                                            {/* Observações / Personalização */}
                                            {(item.observacoes || item.personalizacao) && (
                                                <div className="item-extras-v2">
                                                    {item.observacoes && (
                                                        <div className="extra-box note">
                                                            <p>{item.observacoes}</p>
                                                        </div>
                                                    )}
                                                    {item.personalizacao && typeof item.personalizacao === 'object' && !Array.isArray(item.personalizacao) && (
                                                        <div className="extra-box options">
                                                            {Object.entries(item.personalizacao).map(([key, value]) => (
                                                                <p key={key}><strong>{key}:</strong> {value}</p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Payment Section */}
                            <section className="modal-section-v2">
                                <div className="payment-summary-card">
                                    <div className="summary-row">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                    </div>
                                    {selectedOrder.taxa_entrega > 0 && (
                                        <div className="summary-row">
                                            <span>Taxa de Entrega</span>
                                            <span>{formatCurrency(selectedOrder.taxa_entrega)}</span>
                                        </div>
                                    )}
                                    <div className="summary-row total">
                                        <span>Total do Pedido</span>
                                        <span>{formatCurrency(selectedOrder.valor_total)}</span>
                                    </div>
                                    <div className="payment-method-v2">
                                        <DollarSign size={16} />
                                        <span>Pagamento: <strong>{selectedOrder.forma_pagamento?.toUpperCase()}</strong></span>
                                        {selectedOrder.troco_para && (
                                            <span className="troco"> (Troco p/ {formatCurrency(selectedOrder.troco_para)})</span>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* General Observations */}
                            {selectedOrder.observacoes && (
                                <section className="modal-section-v2">
                                    <h3 className="section-title-v2"><AlertCircle size={16} /> Observações Gerais</h3>
                                    <div className="general-notes-box">
                                        {selectedOrder.observacoes}
                                    </div>
                                </section>
                            )}
                        </div>

                        <div className="modal-actions-premium">
                            <button className="btn-action secondary btn-print">
                                <Check size={18} /> Imprimir Cupom
                            </button>

                            {selectedOrder.status === 'confirmado' && (
                                <button className="btn-action primary" onClick={() => handleStatusChange(selectedOrder.id, 'preparando')}>
                                    <Play size={18} /> Enviar p/ Cozinha
                                </button>
                            )}

                            {selectedOrder.status === 'preparando' && (
                                <button className="btn-action success" onClick={() => handleStatusChange(selectedOrder.id, 'saiu_entrega')}>
                                    <Truck size={18} /> Saiu p/ Entrega
                                </button>
                            )}

                            {selectedOrder.status === 'saiu_entrega' && (
                                <button className="btn-action success" onClick={() => handleStatusChange(selectedOrder.id, 'entregue')}>
                                    <CheckCircle2 size={18} /> Finalizar Pedido
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


