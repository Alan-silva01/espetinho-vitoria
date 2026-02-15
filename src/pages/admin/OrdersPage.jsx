import { useState, useEffect, useRef } from 'react'
import {
    Clock, CheckCircle2, Truck, AlertCircle,
    MoreHorizontal, Phone, MapPin, DollarSign,
    User, ChevronRight, X, Utensils, Timer,
    Store, Bike, Play, Check, Calendar, Search, Bell, Printer
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './OrdersPage.css'

// Importando a logo para garantir que ela esteja disponível para o print
import logoImg from '../../../logo.png'

const STAGES = [
    { id: 'confirmado', label: 'Recebido', icon: AlertCircle, color: '#FBBF24', next: 'preparando', nextLabel: 'Iniciar Preparo' },
    { id: 'preparando', label: 'Preparando', icon: Utensils, color: '#8B5CF6', next: 'saiu_entrega', nextLabel: 'Entregador a caminho' },
    { id: 'saiu_entrega', label: 'Saiu para Entrega', icon: Bike, color: '#F59E0B', next: 'entregue', nextLabel: 'Finalizar Pedido' },
    { id: 'entregue', label: 'Servido / Finalizado', icon: CheckCircle2, color: '#10B981' }
]

export default function OrdersPage() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeStage, setActiveStage] = useState('confirmado')
    const audioRef = useRef(new Audio('/notificacao.mp3'))

    const playNotificationSound = () => {
        const audio = audioRef.current
        audio.currentTime = 0
        audio.play().catch(e => {
            console.error('Erro ao tocar áudio:', e)
            alert('Atenção: O som de notificação foi bloqueado pelo navegador. Por favor, clique em qualquer lugar da página para ativar os alertas sonoros.')
        })
    }

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
                    // Tocar som de notificação de forma robusta
                    playNotificationSound()
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
        const brDateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' })
        const [month, day, year] = brDateStr.split('/')
        const brMidnightAsUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0))

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
            setOrders(previousOrders)
            alert('Erro ao atualizar status do pedido. Tente novamente.')
        }
    }

    const handlePrint = () => {
        window.print();
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
    }

    const onDrop = (e, targetStage) => {
        e.preventDefault()
        const orderId = e.dataTransfer.getData('orderId')
        if (orderId) {
            handleStatusChange(orderId, targetStage)
        }
    }

    const getMinutesAgo = (date) => {
        if (!date) return 0
        const diff = new Date() - new Date(date)
        return Math.floor(diff / 60000)
    }

    const filteredOrders = orders.filter(order => {
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
                <div className="orders-actions">
                    <button
                        className="btn-test-sound"
                        onClick={playNotificationSound}
                        title="Testar som de notificação"
                    >
                        <Bell size={18} />
                        <span>Testar Som</span>
                    </button>
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar pedido, cliente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {/* Mobile Stage Selector */}
            <div className="mobile-stage-tabs hide-scrollbar">
                {STAGES.map(stage => {
                    const count = filteredOrders.filter(o => o.status === stage.id).length
                    return (
                        <button
                            key={stage.id}
                            className={`stage-tab ${activeStage === stage.id ? 'active' : ''}`}
                            onClick={() => setActiveStage(stage.id)}
                            style={{ '--stage-color': stage.color }}
                        >
                            <stage.icon size={16} />
                            <span>{stage.label}</span>
                            <span className="count-dot">{count}</span>
                        </button>
                    )
                })}
            </div>

            <div className="kanban-scroller hide-scrollbar">
                <div className="kanban-board">
                    {STAGES.map(stage => {
                        const stageOrders = filteredOrders.filter(o => o.status === stage.id)

                        return (
                            <div
                                key={stage.id}
                                className={`kanban-col ${activeStage === stage.id ? 'active' : ''}`}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDrop(e, stage.id)}
                            >
                                <div className="col-header" style={{ borderTop: `4px solid ${stage.color}` }}>
                                    <div className="header-label">
                                        <stage.icon size={18} color={stage.color} />
                                        <h3>{stage.id === 'entregue' && selectedOrder?.tipo_pedido === 'mesa' ? 'Servido' : stage.label}</h3>
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
                                                    {order.tipo_pedido === 'entrega' ? <Bike size={10} /> : order.tipo_pedido === 'mesa' ? <Utensils size={10} /> : <Store size={10} />}
                                                    {order.tipo_pedido === 'mesa' ? order.nome_cliente : order.tipo_pedido}
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const nextStatus = (order.tipo_pedido === 'mesa' && stage.id === 'preparando') ? 'entregue' : stage.next;
                                                        handleStatusChange(order.id, nextStatus);
                                                    }}
                                                >
                                                    {order.tipo_pedido === 'mesa' && stage.id === 'preparando' ? 'Servir Pedido' : stage.nextLabel}
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
                <>
                    {/* MODAL VIEW (SCREEN) */}
                    <div className="modal-overlay-v4 no-print" onClick={() => setSelectedOrder(null)}>
                        <div className="modal-kitchen-v4" onClick={e => e.stopPropagation()}>
                            <div className="modal-v4-header">
                                <h2>PEDIDO #{selectedOrder.numero_pedido}</h2>
                                <button className="close-v4-btn" onClick={() => setSelectedOrder(null)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-v4-body hide-scrollbar">
                                <div className="v4-customer-info">
                                    <h3>{selectedOrder.nome_cliente?.toUpperCase()}</h3>
                                    <p>{selectedOrder.telefone_cliente}</p>
                                </div>

                                <div className="v4-items-list">
                                    {selectedOrder.itens?.map((item, idx) => (
                                        <div key={idx} className="v4-item-card">
                                            <div className="v4-item-main">
                                                <span className="v4-item-qty">{item.quantidade}X</span>
                                                <span className="v4-item-name">{item.produtos?.nome}</span>
                                            </div>

                                            {(item.personalizacao || item.observacoes) && (
                                                <div className="v4-item-details">
                                                    {item.personalizacao && typeof item.personalizacao === 'object' && Object.entries(item.personalizacao).map(([k, v]) => (
                                                        <div key={k} className="v4-detail-row">
                                                            {k}: {String(v)}
                                                        </div>
                                                    ))}
                                                    {item.observacoes && (
                                                        <div className="v4-item-obs">
                                                            OBS: {item.observacoes}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="v4-info-box">
                                    <div className="v4-row">
                                        <span>TIPO:</span>
                                        <span>{selectedOrder.tipo_pedido === 'mesa' ? selectedOrder.nome_cliente?.toUpperCase() : selectedOrder.tipo_pedido?.toUpperCase()}</span>
                                    </div>
                                    {selectedOrder.tipo_pedido === 'entrega' && selectedOrder.endereco && (
                                        <div className="v4-row" style={{ flexDirection: 'column', gap: '4px' }}>
                                            <span>ENDEREÇO:</span>
                                            <span style={{ fontSize: '20px', color: '#111827' }}>
                                                {typeof selectedOrder.endereco === 'string'
                                                    ? selectedOrder.endereco.toUpperCase()
                                                    : `${selectedOrder.endereco.rua?.toUpperCase()}, ${selectedOrder.endereco.numero} - ${selectedOrder.endereco.bairro?.toUpperCase()}`}
                                                {selectedOrder.endereco.referencia && <><br /><small>REF: {selectedOrder.endereco.referencia?.toUpperCase()}</small></>}
                                            </span>
                                        </div>
                                    )}
                                    {selectedOrder.observacoes && (
                                        <div className="v4-item-obs" style={{ marginTop: '8px' }}>
                                            OBS GERAL: {selectedOrder.observacoes?.toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div className="v4-info-box">
                                    <div className="v4-row">
                                        <span>SUBTOTAL:</span>
                                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                    </div>
                                    {selectedOrder.taxa_entrega > 0 && (
                                        <div className="v4-row">
                                            <span>FRETE:</span>
                                            <span>{formatCurrency(selectedOrder.taxa_entrega)}</span>
                                        </div>
                                    )}
                                    <div className="v4-total-row">
                                        <span>TOTAL:</span>
                                        <span>{formatCurrency(selectedOrder.valor_total)}</span>
                                    </div>
                                </div>

                                <div className="v4-payment-pill">
                                    {selectedOrder.forma_pagamento === 'pagar_na_mesa' ? 'PAGAR NA MESA' : selectedOrder.forma_pagamento?.toUpperCase()}
                                    {selectedOrder.troco_para && ` (TROCO P/ ${formatCurrency(selectedOrder.troco_para)})`}
                                </div>
                            </div>

                            <div className="v4-actions">
                                <button className="v4-btn-print" onClick={handlePrint}>
                                    <Printer size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                    IMPRIMIR
                                </button>

                                {selectedOrder.status === 'confirmado' && (
                                    <button className="v4-btn-status" onClick={() => handleStatusChange(selectedOrder.id, 'preparando')}>
                                        MANDAR P/ COZINHA
                                    </button>
                                )}

                                {selectedOrder.status === 'preparando' && (
                                    <button
                                        className="v4-btn-status"
                                        onClick={() => handleStatusChange(selectedOrder.id, selectedOrder.tipo_pedido === 'mesa' ? 'entregue' : 'saiu_entrega')}
                                    >
                                        {selectedOrder.tipo_pedido === 'mesa' ? 'SERVIR PEDIDO' : 'SAIU P/ ENTREGA'}
                                    </button>
                                )}

                                {selectedOrder.status === 'saiu_entrega' && (
                                    <button className="v4-btn-status" onClick={() => handleStatusChange(selectedOrder.id, 'entregue')}>
                                        FINALIZAR PEDIDO
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* THERMAL RECEIPT (PRINT ONLY) */}
                    <div id="thermal-receipt">
                        <div className="receipt-print-container">
                            <div className="receipt-logo-container">
                                <img src={logoImg} alt="VITORIA" className="receipt-logo" />
                            </div>

                            <div className="receipt-header-info">
                                <div className="receipt-order-num">PEDIDO #{selectedOrder.numero_pedido}</div>
                                <div className="receipt-type">{selectedOrder.tipo_pedido === 'entrega' ? 'ENTREGA PARCEIRA' : selectedOrder.tipo_pedido === 'mesa' ? selectedOrder.nome_cliente?.toUpperCase() : 'RETIRADA NA LOJA'}</div>
                                <div className="receipt-date">
                                    {new Date(selectedOrder.criado_em).toLocaleDateString('pt-BR')} - {new Date(selectedOrder.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            <div className="receipt-divider"></div>

                            <div className="receipt-section">
                                <div className="receipt-section-title">ESTABELECIMENTO</div>
                                <div style={{ textAlign: 'center' }}>ESPETINHO VITÓRIA - ESPETOS, AÇAÍ E CALDOS</div>
                            </div>

                            <div className="receipt-divider"></div>

                            <div className="receipt-section">
                                <div className="receipt-section-title">CLIENTE</div>
                                <div className="receipt-data-row">
                                    <span className="receipt-label">NOME:</span>
                                    <span>{selectedOrder.nome_cliente?.toUpperCase() || 'N/A'}</span>
                                </div>
                                <div className="receipt-data-row">
                                    <span className="receipt-label">TEL:</span>
                                    <span>{selectedOrder.telefone_cliente || selectedOrder.clientes?.telefone || 'N/A'}</span>
                                </div>
                            </div>

                            {selectedOrder.tipo_pedido === 'entrega' && selectedOrder.endereco && (
                                <>
                                    <div className="receipt-divider"></div>
                                    <div className="receipt-section">
                                        <div className="receipt-section-title">ENDEREÇO DE ENTREGA</div>
                                        <div>
                                            {typeof selectedOrder.endereco === 'string'
                                                ? selectedOrder.endereco.toUpperCase()
                                                : `${selectedOrder.endereco.rua?.toUpperCase()}, ${selectedOrder.endereco.numero}`}
                                        </div>
                                        <div>{selectedOrder.endereco.bairro?.toUpperCase()}</div>
                                        {selectedOrder.endereco.referencia && <div>REF: {selectedOrder.endereco.referencia.toUpperCase()}</div>}
                                    </div>
                                </>
                            )}

                            <div className="receipt-divider"></div>

                            <div className="receipt-section">
                                <div className="receipt-section-title">ITENS DO PEDIDO</div>
                                <table className="receipt-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '10%' }}>QTD</th>
                                            <th style={{ width: '65%' }}>ITENS</th>
                                            <th style={{ width: '25%', textAlign: 'right' }}>PREÇO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrder.itens?.map((item, i) => (
                                            <tr key={i}>
                                                <td>{item.quantidade}</td>
                                                <td>
                                                    <div>{item.produtos?.nome?.toUpperCase()}</div>
                                                    {item.personalizacao && typeof item.personalizacao === 'object' && Object.entries(item.personalizacao).map(([k, v]) => (
                                                        <div key={k} className="receipt-item-details">
                                                            - {k.toUpperCase()}: {String(v).toUpperCase()}
                                                        </div>
                                                    ))}
                                                    {item.observacoes && (
                                                        <div className="receipt-item-details" style={{ fontWeight: 'bold' }}>
                                                            * OBS: {item.observacoes.toUpperCase()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(item.preco_unitario * item.quantidade)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="receipt-divider"></div>

                            <div className="receipt-total-section">
                                <div className="receipt-total-row">
                                    <span>ITENS DO PEDIDO</span>
                                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                </div>
                                {selectedOrder.taxa_entrega > 0 && (
                                    <div className="receipt-total-row">
                                        <span>TAXA DE ENTREGA</span>
                                        <span>{formatCurrency(selectedOrder.taxa_entrega)}</span>
                                    </div>
                                )}
                                <div className="receipt-total-big">
                                    <span>TOTAL</span>
                                    <span>{formatCurrency(selectedOrder.valor_total)}</span>
                                </div>
                            </div>

                            <div className="receipt-divider"></div>

                            <div className="receipt-section">
                                <div className="receipt-section-title">FORMA DE PAGAMENTO</div>
                                <div className="receipt-data-row">
                                    <span>{selectedOrder.forma_pagamento?.toUpperCase()}</span>
                                    <span>{formatCurrency(selectedOrder.valor_total)}</span>
                                </div>
                                {selectedOrder.troco_para && (
                                    <div className="receipt-data-row" style={{ marginTop: '2mm' }}>
                                        <span className="receipt-label">TROCO PARA:</span>
                                        <span>{formatCurrency(selectedOrder.troco_para)}</span>
                                    </div>
                                )}
                            </div>

                            {selectedOrder.observacoes && (
                                <>
                                    <div className="receipt-divider"></div>
                                    <div className="receipt-section">
                                        <div className="receipt-section-title">OBSERVAÇÃO GERAL</div>
                                        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{selectedOrder.observacoes.toUpperCase()}</div>
                                    </div>
                                </>
                            )}

                            <div className="receipt-footer-msg">
                                OBRIGADO PELA PREFERÊNCIA!<br />
                                ESPETINHO VITÓRIA
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
