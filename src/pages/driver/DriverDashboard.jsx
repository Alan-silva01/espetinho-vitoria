import { useState, useEffect, useCallback, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import {
    Bike, LogOut, CheckCircle,
    Bell, MapPin, Phone, Info, Clock,
    Smartphone, Wallet, CreditCard, MessageCircle, X,
    Package, ChevronRight, Navigation2, Timer, Flame
} from 'lucide-react'
import { useDriverAuth } from '../../hooks/useDriverAuth'
import { supabase } from '../../lib/supabase'
import { formatCurrency, filterPersonalizacao } from '../../lib/utils'
import './DriverDashboard.css'

function getAddressString(endereco) {
    if (!endereco) return 'Endereço não informado'
    if (typeof endereco === 'string') return endereco
    const parts = []
    if (endereco.rua) parts.push(endereco.rua)
    if (endereco.numero) parts.push(endereco.numero)
    if (endereco.bairro) parts.push(`- ${endereco.bairro}`)
    return parts.join(', ') || 'Endereço não informado'
}

function getGoogleMapsLink(endereco) {
    if (!endereco || typeof endereco === 'string') return null
    return endereco.google_maps_link || null
}

function getPaymentLabel(forma) {
    const metodo = forma || '';
    if (metodo === 'pix') return 'PIX'
    if (metodo === 'dinheiro') return 'Dinheiro'
    if (metodo?.includes('cartao')) return 'Cartão'
    return metodo || '--'
}

function getPaymentIcon(forma) {
    const metodo = forma || ''
    if (metodo === 'pix') return <Smartphone size={14} />
    if (metodo === 'dinheiro') return <Wallet size={14} />
    return <CreditCard size={14} />
}

function getItemsSummary(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return 'Sem itens'
    const total = itens.reduce((sum, i) => sum + (i.quantidade || 1), 0)
    const names = itens.slice(0, 3).map(i => `${i.quantidade}x ${i.nome}`).join(', ')
    if (itens.length > 3) return `${names} +${itens.length - 3}`
    return names
}

export default function DriverDashboard() {
    const { driver, logout, loading: authLoading, initializing } = useDriverAuth()
    const [orders, setOrders] = useState([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [paymentModal, setPaymentModal] = useState({ open: false, order: null })
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null)
    const [receivedValor, setReceivedValor] = useState('')
    const [savingPayment, setSavingPayment] = useState(false)
    const [notificationsPermission, setNotificationsPermission] = useState(
        window.Notification ? Notification.permission : 'default'
    )
    const paymentModalRef = useRef(null)
    const inFlightOrdersRef = useRef(new Set()) // Guards against realtime reverting optimistic updates

    useEffect(() => {
        paymentModalRef.current = paymentModal
    }, [paymentModal])

    // Monitorar permissão de notificação
    useEffect(() => {
        const checkPermission = async () => {
            if (window.OneSignal) {
                try {
                    const isPushEnabled = await window.OneSignal.Notifications.permission;
                    const status = isPushEnabled ? 'granted' : (window.Notification?.permission || 'default');
                    setNotificationsPermission(status);
                } catch (e) {
                    console.warn('[OneSignal] Error checking permission:', e);
                }
            } else if (window.Notification) {
                setNotificationsPermission(Notification.permission);
            }
        };

        const timer = setInterval(checkPermission, 3000);
        checkPermission();
        return () => clearInterval(timer);
    }, []);

    const requestNotificationPermission = async () => {
        if (window.OneSignal) {
            try {
                // Tenta carregar o prompt nativo ou slidedown
                await window.OneSignal.Notifications.requestPermission();
                if (window.OneSignal.Slidedown) {
                    await window.OneSignal.Slidedown.promptPush();
                }
            } catch (e) {
                console.error('[OneSignal] Request permission error:', e);
            }
        }
    };


    const fetchDriverOrders = useCallback(async () => {
        if (!driver?.id) return

        try {
            const now = new Date()
            const brTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
            const brDate = new Date(brTimeStr)
            brDate.setHours(0, 0, 0, 0)
            const brMidnightAsUTC = new Date(Date.UTC(brDate.getFullYear(), brDate.getMonth(), brDate.getDate(), 3, 0, 0))

            const { data, error } = await supabase
                .from('pedidos')
                .select('*, entregadores(nome), itens_pedido(*, produtos(nome, imagem_url))')
                .eq('tipo_pedido', 'entrega')
                .gte('criado_em', brMidnightAsUTC.toISOString())
                .order('criado_em', { ascending: false })

            if (!error) {
                const enriched = (data || []).map(order => ({
                    ...order,
                    itens: (order.itens_pedido || []).map(ip => ({
                        quantidade: ip.quantidade,
                        nome: ip.produtos?.nome || 'Item',
                        preco: ip.preco_unitario,
                        observacoes: ip.observacoes,
                        personalizacao: ip.personalizacao
                    }))
                }))
                setOrders(enriched)
            } else {
                console.error('Erro ao buscar pedidos:', error)
            }
        } catch (err) {
            console.error('Critical Error in fetchDriverOrders:', err)
        } finally {
            setInitialLoading(false)
        }
    }, [driver])

    useEffect(() => {
        let channel = null
        if (driver?.id) {
            fetchDriverOrders()  // initial load — will set initialLoading=false in finally

            try {
                channel = supabase
                    .channel(`driver_orders_${driver.id}`)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'pedidos', filter: 'tipo_pedido=eq.entrega' },
                        (payload) => {
                            if (payload.eventType === 'UPDATE') {
                                // Skip realtime merge for orders we are currently updating
                                // to prevent reverting our optimistic update
                                if (inFlightOrdersRef.current.has(payload.new.id)) {
                                    console.log('[Realtime] Skipping merge for in-flight order:', payload.new.id)
                                    return
                                }

                                // 1. Optimistic Update: Update order properties instantly in UI
                                setOrders(prev => prev.map(order =>
                                    order.id === payload.new.id ? { ...order, ...payload.new } : order
                                ))

                                // 2. Silent Refresh: Sync full data (items, etc) after a small delay
                                setTimeout(() => {
                                    // Double-check the order is still not in-flight before refreshing
                                    if (inFlightOrdersRef.current.has(payload.new.id)) return

                                    fetchDriverOrders().then(() => {
                                        // Sync payment modal if the updated order is the one being viewed
                                        if (paymentModalRef.current?.open && paymentModalRef.current?.order?.id === payload.new.id) {
                                            setOrders(currentOrders => {
                                                const updated = currentOrders.find(o => o.id === payload.new.id)
                                                if (updated) setPaymentModal(prev => ({ ...prev, order: updated }))
                                                return currentOrders
                                            })
                                        }
                                    })
                                }, 800)
                            } else {
                                // For INSERT/DELETE or other, just refresh
                                fetchDriverOrders()
                            }
                        }
                    )
                    .subscribe()
            } catch (err) {
                console.error('[Dashboard] Erro Realtime:', err)
            }

            return () => {
                if (channel) supabase.removeChannel(channel)
            }
        }
    }, [driver, fetchDriverOrders])

    const openPaymentModal = (order) => {
        setSelectedOrder(null)
        setReceivedValor(order.valor_total?.toString() || '0')
        setSelectedPaymentMethod(null)
        setTimeout(() => {
            setPaymentModal({ open: true, order })
        }, 150)
    }

    const confirmPayment = async () => {
        // Guard: prevent double-clicks
        if (savingPayment) return
        if (!paymentModal.order || !selectedPaymentMethod) return

        // Capture order ID immediately to prevent stale closure issues
        const orderId = paymentModal.order.id
        const orderNumero = paymentModal.order.numero_pedido

        setSavingPayment(true)
        // Mark this order as in-flight so realtime won't revert our update
        inFlightOrdersRef.current.add(orderId)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        try {
            const now = new Date().toISOString()
            const updatePayload = {
                status: 'entregue',
                entregue_em: now,
                entregador_id: driver.id,
                recebido_por_status: true,
                recebido_valor: Number(receivedValor) || 0,
                recebido_metodo: selectedPaymentMethod,
                recebido_em: now
            }

            console.log('[Driver] Updating order:', orderId, '(#' + orderNumero + ')', updatePayload)

            const { data, error } = await supabase
                .from('pedidos')
                .update(updatePayload)
                .eq('id', orderId)
                .select()
                .abortSignal(controller.signal)

            console.log('[Driver] Update result:', { data, error })

            if (error) throw error

            if (!data || data.length === 0) {
                throw new Error('Sem permissão para atualizar este pedido. Verifique as permissões do banco.')
            }

            // Optimistic update: move order to 'entregue' in local state immediately
            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, ...updatePayload } : o
            ))

            setPaymentModal({ open: false, order: null })

            // Release in-flight guard after a delay, then do a silent refresh
            setTimeout(() => {
                inFlightOrdersRef.current.delete(orderId)
                fetchDriverOrders()
            }, 2000)
        } catch (err) {
            console.error('[Driver] Erro ao finalizar:', err)
            // Release in-flight guard on error
            inFlightOrdersRef.current.delete(orderId)
            if (err.name === 'AbortError') {
                alert('A requisição demorou demais. Verifique sua conexão e tente novamente.')
            } else {
                alert('Erro ao finalizar pedido: ' + err.message)
            }
        } finally {
            clearTimeout(timeoutId)
            setSavingPayment(false)
        }
    }

    if (initializing || authLoading || initialLoading) return (
        <div className="driver-loading">
            <Bike size={40} className="animate-bounce" />
            <p>{initializing ? 'Iniciando sistema...' : 'Carregando pedidos...'}</p>
        </div>
    )

    if (!driver && !initializing) return <Navigate to="/entregador/login" replace />

    if (driver && driver.ativo === false) {
        return (
            <div className="driver-dashboard-container">
                <header className="driver-app-header">
                    <div className="driver-profile-mini">
                        <div className="driver-avatar">
                            <Bike size={20} />
                        </div>
                        <div>
                            <span className="welcome">Olá,</span>
                            <h2 className="driver-name">{driver.nome?.split(' ')[0]}</h2>
                        </div>
                    </div>
                    <button className="btn-logout-mini" onClick={logout} title="Sair">
                        <LogOut size={18} />
                    </button>
                </header>

                <div className="inactive-blocked-card animate-scale-in">
                    <div className="blocked-icon">
                        <X size={32} />
                    </div>
                    <h2>Acesso Suspenso</h2>
                    <p>
                        Seu perfil de entregador está <strong>inativo</strong> no momento.
                    </p>
                    <div className="blocked-info">
                        <Info size={16} />
                        <p>Entre em contato com o administrador para ativar seu cadastro e começar a receber pedidos.</p>
                    </div>
                    <button className="btn-finish-large" onClick={() => window.location.reload()}>
                        Verificar Novamente
                    </button>
                </div>
            </div>
        )
    }

    try {
        const incomingOrders = Array.isArray(orders) ? orders.filter(o => o?.tipo_pedido === 'entrega' && (o?.status === 'confirmado' || o?.status === 'preparando')) : []
        const pendingOrders = Array.isArray(orders) ? orders.filter(o => o?.status === 'saiu_entrega') : []
        const completedOrders = Array.isArray(orders) ? orders.filter(o => o?.status === 'entregue') : []

        return (
            <div className="driver-dashboard-container">
                <header className="driver-app-header">
                    <div className="driver-profile-mini">
                        <div className="driver-avatar">
                            <Bike size={20} />
                        </div>
                        <div>
                            <span className="welcome">Olá,</span>
                            <h2 className="driver-name">{driver?.nome ? driver.nome.split(' ')[0] : 'Entregador'}</h2>
                        </div>
                    </div>
                    <button className="btn-logout-mini" onClick={logout}>
                        <LogOut size={18} />
                    </button>
                </header>

                <main className="driver-app-main">
                    {notificationsPermission !== 'granted' && (
                        <div className="notification-banner animate-slide-up">
                            <div className="banner-icon">
                                <Bell size={20} />
                            </div>
                            <div className="banner-text">
                                <h4>Ativar Notificações?</h4>
                                <p>Receba alertas de novos pedidos em tempo real.</p>
                            </div>
                            <button className="btn-enable-notify" onClick={requestNotificationPermission}>
                                Ativar
                            </button>
                        </div>
                    )}


                    {/* Novos Pedidos - Aguardando Preparo */}
                    {incomingOrders.length > 0 && (
                        <div className="kanban-section incoming">
                            <div className="section-title incoming-title">
                                <Flame size={18} />
                                <h3>Novo Pedido</h3>
                                <span className="count-pill incoming-pill">{incomingOrders.length}</span>
                            </div>

                            <div className="orders-list-mobile">
                                {incomingOrders.map(order => (
                                    <div key={order.id} className="driver-order-card incoming-card" onClick={() => setSelectedOrder(order)}>
                                        <div className="waiting-badge">
                                            <Timer size={14} />
                                            <span>Aguardando preparo</span>
                                        </div>

                                        <div className="card-header">
                                            <span className="order-number">#{order.numero_pedido}</span>
                                            <span className="order-time">
                                                <Clock size={12} />
                                                {order.criado_em ? new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </span>
                                        </div>

                                        <div className="customer-info">
                                            <h4>{order.nome_cliente}</h4>
                                        </div>

                                        <div className="card-address-row">
                                            <MapPin size={14} />
                                            <span>{getAddressString(order.endereco)}</span>
                                            {getGoogleMapsLink(order.endereco) && (
                                                <a
                                                    href={getGoogleMapsLink(order.endereco)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn-ver-rota-mini"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <Navigation2 size={12} />
                                                    Rota
                                                </a>
                                            )}
                                        </div>

                                        {order.endereco?.bairro && (
                                            <div className="card-bairro-row">
                                                <span>📍 {order.endereco.bairro}</span>
                                                {order.endereco?.referencia && (
                                                    <span className="ref-inline">Ref: {order.endereco.referencia}</span>
                                                )}
                                            </div>
                                        )}

                                        <div className="card-items-row">
                                            <Package size={14} />
                                            <span>{getItemsSummary(order.itens)}</span>
                                        </div>

                                        <div className="card-actions">
                                            <div className="card-actions-left">
                                                <div className="card-payment-badge">
                                                    {getPaymentIcon(order.forma_pagamento)}
                                                    <span>{getPaymentLabel(order.forma_pagamento)}</span>
                                                </div>
                                                <div className="total-price">
                                                    <strong>{formatCurrency(order.valor_total)}</strong>
                                                </div>
                                            </div>
                                            <div className="incoming-status-tag">
                                                <Clock size={14} />
                                                <span>{order.status === 'confirmado' ? 'Recebido' : 'Preparando'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Para Entregar */}
                    <div className="kanban-section">
                        <div className="section-title">
                            <Package size={18} />
                            <h3>Para Entregar</h3>
                            <span className="count-pill">{pendingOrders.length}</span>
                        </div>

                        <div className="orders-list-mobile">
                            {pendingOrders.length > 0 ? pendingOrders.map(order => (
                                <div key={order.id} className="driver-order-card" onClick={() => setSelectedOrder(order)}>
                                    <div className="card-header">
                                        <span className="order-number">#{order.numero_pedido}</span>
                                        <span className="order-time">
                                            <Clock size={12} />
                                            {order.criado_em ? new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </span>
                                    </div>

                                    <div className="customer-info">
                                        <h4>{order.nome_cliente}</h4>
                                    </div>

                                    {/* Address preview */}
                                    <div className="card-address-row">
                                        <MapPin size={14} />
                                        <span>{getAddressString(order.endereco)}</span>
                                        {getGoogleMapsLink(order.endereco) && (
                                            <a
                                                href={getGoogleMapsLink(order.endereco)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn-ver-rota-mini"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Navigation2 size={12} />
                                                Rota
                                            </a>
                                        )}
                                    </div>

                                    {/* Items summary */}
                                    <div className="card-items-row">
                                        <Package size={14} />
                                        <span>{getItemsSummary(order.itens)}</span>
                                    </div>

                                    {/* Footer: payment + value + action */}
                                    <div className="card-actions">
                                        <div className="card-actions-left">
                                            <div className="card-payment-badge">
                                                {getPaymentIcon(order.forma_pagamento)}
                                                <span>{getPaymentLabel(order.forma_pagamento)}</span>
                                            </div>
                                            <div className="total-price">
                                                <strong>{formatCurrency(order.valor_total)}</strong>
                                            </div>
                                        </div>
                                        <button
                                            className="btn-finish-delivery"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openPaymentModal(order)
                                            }}
                                        >
                                            <CheckCircle size={16} />
                                            <span>Entreguei</span>
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

                    {/* Concluídos */}
                    <div className="kanban-section completed">
                        <div className="section-title">
                            <CheckCircle size={18} />
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
                                        <p className="finish-time">Entregue às {order.entregue_em ? new Date(order.entregue_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                                    </div>
                                    <div className="card-footer">
                                        <span className="total">{formatCurrency(order.valor_total)}</span>
                                        <div className="status-badge">
                                            <CheckCircle size={12} />
                                            Concluído
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>

                {/* ===== ORDER DETAIL SHEET ===== */}
                {selectedOrder && (
                    <div className="driver-modal-overlay" onClick={() => setSelectedOrder(null)}>
                        <div className="order-detail-sheet animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="sheet-handle"></div>

                            <div className="detail-header">
                                <div>
                                    <span className="order-badge">Pedido #{selectedOrder.numero_pedido}</span>
                                    <h3>{selectedOrder.nome_cliente}</h3>
                                </div>
                                <button className="btn-close-sheet" onClick={() => setSelectedOrder(null)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="detail-body">
                                {/* Address - FIRST and prominent */}
                                <div className="info-section address-highlight">
                                    <label><MapPin size={14} /> Endereço de Entrega</label>
                                    <div className="address-box">
                                        <p>
                                            <strong>{typeof selectedOrder.endereco === 'string'
                                                ? selectedOrder.endereco
                                                : (selectedOrder.endereco ? `${selectedOrder.endereco.rua || ''}, ${selectedOrder.endereco.numero || ''}` : 'Endereço não informado')}</strong>
                                        </p>
                                        {selectedOrder.endereco?.bairro && <p>{selectedOrder.endereco.bairro}</p>}
                                        {selectedOrder.endereco?.referencia && (
                                            <p className="ref-text"><span>Ref:</span> {selectedOrder.endereco.referencia}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Contact + Route */}
                                <div className="contact-actions">
                                    <a
                                        href={`tel:${selectedOrder.telefone_cliente?.replace(/\D/g, '')}`}
                                        className="contact-btn phone"
                                    >
                                        <Phone size={18} />
                                        Ligar
                                    </a>
                                    <a
                                        href={`https://wa.me/55${selectedOrder.telefone_cliente?.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="contact-btn whatsapp"
                                    >
                                        <MessageCircle size={18} />
                                        WhatsApp
                                    </a>
                                    {getGoogleMapsLink(selectedOrder.endereco) && (
                                        <a
                                            href={getGoogleMapsLink(selectedOrder.endereco)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="contact-btn route"
                                        >
                                            <Navigation2 size={18} />
                                            Ver Rota
                                        </a>
                                    )}
                                </div>

                                {/* Payment + Value */}
                                <div className="info-section">
                                    <label><Wallet size={14} /> Pagamento</label>
                                    <div className="payment-box">
                                        <div className="payment-info">
                                            <span className={`payment-tag ${selectedOrder.forma_pagamento}`}>
                                                {getPaymentLabel(selectedOrder.forma_pagamento)}
                                            </span>
                                            {selectedOrder.forma_pagamento === 'dinheiro' && selectedOrder.troco_para && (
                                                <span className="change-info">Troco p/ {formatCurrency(selectedOrder.troco_para)}</span>
                                            )}
                                        </div>
                                        <div className="total-amount">
                                            <span>Total a receber:</span>
                                            <strong>{formatCurrency(selectedOrder.valor_total)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="info-section">
                                    <label><Info size={14} /> Itens do Pedido</label>
                                    <div className="items-list">
                                        {Array.isArray(selectedOrder.itens) && selectedOrder.itens.map((item, idx) => (
                                            <div key={idx} className="item-row">
                                                <span className="item-qty">{item.quantidade}x</span>
                                                <div className="item-details">
                                                    <span className="item-name">{item.nome}</span>
                                                    {item.personalizacao && filterPersonalizacao(item.personalizacao, item.nome).length > 0 && (
                                                        <span className="item-extras">
                                                            {filterPersonalizacao(item.personalizacao, item.nome).map(p => p.value).join(', ')}
                                                        </span>
                                                    )}
                                                    {item.observacoes && (
                                                        <span className="item-obs">Obs: {item.observacoes}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedOrder.observacoes && (
                                    <div className="info-section">
                                        <label>Observações Gerais</label>
                                        <p className="general-obs">{selectedOrder.observacoes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="sheet-footer">
                                <button
                                    className="btn-finish-large"
                                    onClick={() => openPaymentModal(selectedOrder)}
                                >
                                    <CheckCircle size={20} />
                                    Confirmar Entrega
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== PAYMENT MODAL ===== */}
                {paymentModal.open && paymentModal.order && (
                    <div className="driver-modal-overlay" onClick={() => !savingPayment && setPaymentModal({ open: false, order: null })}>
                        <div className="payment-modal animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="payment-modal-header">
                                <h3>Confirmar Recebimento</h3>
                                <p>Pedido <strong>#{paymentModal.order.numero_pedido}</strong> — {paymentModal.order.nome_cliente}</p>
                            </div>

                            <div className="value-preview">
                                <label>Valor Recebido</label>
                                <div className="input-money">
                                    <span>R$</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={receivedValor}
                                        onChange={e => setReceivedValor(e.target.value)}
                                    />
                                </div>
                            </div>

                            <p className="payment-prompt">Como o cliente pagou?</p>

                            <div className="payment-options">
                                <button
                                    className={`btn-pay pix ${selectedPaymentMethod === 'pix' ? 'selected' : ''}`}
                                    onClick={() => setSelectedPaymentMethod('pix')}
                                    disabled={savingPayment}
                                >
                                    <Smartphone size={24} />
                                    <span>PIX</span>
                                </button>
                                <button
                                    className={`btn-pay card ${selectedPaymentMethod === 'cartao' ? 'selected' : ''}`}
                                    onClick={() => setSelectedPaymentMethod('cartao')}
                                    disabled={savingPayment}
                                >
                                    <CreditCard size={24} />
                                    <span>CARTÃO</span>
                                </button>
                                <button
                                    className={`btn-pay cash ${selectedPaymentMethod === 'dinheiro' ? 'selected' : ''}`}
                                    onClick={() => setSelectedPaymentMethod('dinheiro')}
                                    disabled={savingPayment}
                                >
                                    <Wallet size={24} />
                                    <span>DINHEIRO</span>
                                </button>
                            </div>

                            <button
                                className="btn-confirm-payment"
                                onClick={() => confirmPayment()}
                                disabled={!selectedPaymentMethod || savingPayment}
                            >
                                {savingPayment ? (
                                    <span className="btn-spinner" />
                                ) : (
                                    <>
                                        <CheckCircle size={20} />
                                        <span>Confirmar Entrega</span>
                                    </>
                                )}
                            </button>

                            <button
                                className="btn-close-modal"
                                onClick={() => setPaymentModal({ open: false, order: null })}
                                disabled={savingPayment}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    } catch (err) {
        console.error('Critical Render Error:', err)
        return (
            <div className="driver-dashboard-container" style={{ padding: '20px', textAlign: 'center' }}>
                <div className="driver-order-card" style={{ padding: '30px', marginTop: '40px' }}>
                    <X size={48} color="#B91C1C" style={{ margin: '0 auto 20px' }} />
                    <h3 style={{ color: '#1F2937', marginBottom: '10px' }}>Ops! Algo deu errado</h3>
                    <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '20px' }}>
                        Não conseguimos carregar o painel agora. Tente recarregar a página.
                    </p>
                    <button onClick={() => window.location.reload()} className="btn-finish-large">
                        Recarregar Página
                    </button>
                </div>
            </div>
        )
    }
}
