import { useState, useEffect } from 'react'
import {
    Clock, CheckCircle2, Truck, AlertCircle,
    MoreHorizontal, Phone, MapPin, DollarSign,
    User, ChevronRight, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './OrdersPage.css'

const STAGES = [
    { id: 'pendente', label: 'Pendentes', icon: AlertCircle, color: '#F59E0B' },
    { id: 'preparando', label: 'Preparando', icon: Clock, color: '#3B82F6' },
    { id: 'entrega', label: 'Saiu para Entrega', icon: Truck, color: '#10B981' },
    { id: 'finalizado', label: 'Finalizados', icon: CheckCircle2, color: '#6B7280' }
]

export default function OrdersPage() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null)

    useEffect(() => {
        fetchOrders()

        // Real-time subscription
        const channel = supabase
            .channel('orders_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pedidos'
            }, () => {
                fetchOrders()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    async function fetchOrders() {
        const { data, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                itens:itens_pedido(
                    *,
                    produtos(nome, imagem_url)
                )
            `)
            .order('criado_em', { ascending: false })

        if (!error) setOrders(data || [])
        setLoading(false)
    }

    async function updateOrderStatus(orderId, newStatus) {
        const { error } = await supabase
            .from('pedidos')
            .update({
                status: newStatus,
                // Add delivery time if finishing
                ...(newStatus === 'finalizado' ? { entregue_em: new Date().toISOString() } : {}),
                ...(newStatus === 'preparando' ? { confirmado_em: new Date().toISOString() } : {})
            })
            .eq('id', orderId)

        if (error) alert('Erro ao atualizar status: ' + error.message)
    }

    if (loading) return <div className="admin-loading">Carregando pedidos...</div>

    return (
        <div className="orders-kanban-container">
            <header className="admin-page-header">
                <div>
                    <h1>Gestão de Pedidos</h1>
                    <p>Gerencie os pedidos em tempo real.</p>
                </div>
            </header>

            <div className="kanban-board">
                {STAGES.map(stage => (
                    <div key={stage.id} className="kanban-column">
                        <div className="kanban-column-header">
                            <div className="header-title">
                                <stage.icon size={18} color={stage.color} />
                                <h3>{stage.label}</h3>
                            </div>
                            <span className="count-badge">
                                {orders.filter(o => o.status === stage.id).length}
                            </span>
                        </div>

                        <div className="kanban-cards-list">
                            {orders
                                .filter(o => o.status === stage.id)
                                .map(order => (
                                    <div
                                        key={order.id}
                                        className="order-card"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <div className="order-card__header">
                                            <span className="order-number">#{order.numero_pedido}</span>
                                            <span className="order-time">
                                                {new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <h4 className="customer-name">{order.nome_cliente}</h4>

                                        <div className="order-summary">
                                            {order.itens?.length} {order.itens?.length === 1 ? 'item' : 'itens'} • {formatCurrency(order.valor_total)}
                                        </div>

                                        <div className="order-type-badge">
                                            {order.tipo_pedido === 'entrega' ? <Truck size={12} /> : <User size={12} />}
                                            <span>{order.tipo_pedido}</span>
                                        </div>

                                        <div className="order-card__actions" onClick={e => e.stopPropagation()}>
                                            {stage.id === 'pendente' && (
                                                <button
                                                    className="btn-action start"
                                                    onClick={() => updateOrderStatus(order.id, 'preparando')}
                                                >
                                                    Confirmar
                                                </button>
                                            )}
                                            {stage.id === 'preparando' && (
                                                <button
                                                    className="btn-action delivery"
                                                    onClick={() => updateOrderStatus(order.id, 'entrega')}
                                                >
                                                    Enviar
                                                </button>
                                            )}
                                            {stage.id === 'entrega' && (
                                                <button
                                                    className="btn-action finish"
                                                    onClick={() => updateOrderStatus(order.id, 'finalizado')}
                                                >
                                                    Finalizar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="order-modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="order-modal" onClick={e => e.stopPropagation()}>
                        <header className="modal-header">
                            <h2>Pedido #{selectedOrder.numero_pedido}</h2>
                            <button onClick={() => setSelectedOrder(null)}><X size={24} /></button>
                        </header>

                        <div className="modal-body">
                            <section className="modal-section">
                                <h3><User size={18} /> Cliente</h3>
                                <div className="info-row">
                                    <strong>Nome:</strong>
                                    <span>{selectedOrder.nome_cliente}</span>
                                </div>
                                <div className="info-row">
                                    <strong>Telefone:</strong>
                                    <a href={`tel:${selectedOrder.telefone_cliente}`}>{selectedOrder.telefone_cliente}</a>
                                </div>
                            </section>

                            <section className="modal-section">
                                <h3><MapPin size={18} /> Endereço</h3>
                                {selectedOrder.tipo_pedido === 'retirada' ? (
                                    <p>Retirada no Balcão</p>
                                ) : (
                                    <p>{selectedOrder.endereco?.rua}, {selectedOrder.endereco?.numero} - {selectedOrder.endereco?.bairro}</p>
                                )}
                            </section>

                            <section className="modal-section">
                                <h3><ShoppingBag size={18} /> Itens do Pedido</h3>
                                <div className="items-list">
                                    {selectedOrder.itens?.map((item, idx) => (
                                        <div key={idx} className="item-row">
                                            <span>{item.quantidade}x {item.produtos?.nome}</span>
                                            <span>{formatCurrency(item.preco_unitario * item.quantidade)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="total-row">
                                    <strong>Total:</strong>
                                    <strong className="final-price">{formatCurrency(selectedOrder.valor_total)}</strong>
                                </div>
                            </section>

                            <section className="modal-section">
                                <h3><DollarSign size={18} /> Pagamento</h3>
                                <p>Forma: {selectedOrder.forma_pagamento}</p>
                                {selectedOrder.troco_para && <p>Troco para: {formatCurrency(selectedOrder.troco_para)}</p>}
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
