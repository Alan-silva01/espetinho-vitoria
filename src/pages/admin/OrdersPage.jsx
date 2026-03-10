import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Clock, CheckCircle2, Truck, AlertCircle,
    MoreHorizontal, Phone, MapPin, DollarSign,
    User, ChevronRight, X, Utensils, Timer,
    Store, Bike, Play, Check, Calendar, Search, Bell, Printer, RefreshCw, Receipt, Trash2,
    ReceiptText, ChefHat, GlassWater, IceCreamCone, UtensilsCrossed, XCircle, CheckCircle, ArrowRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, filterPersonalizacao, getSmartItemName } from '../../lib/utils'
import { useOrders, useComanda } from '../../hooks/useOrders'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'

import Dialog from '../../components/ui/Dialog'
import './OrdersPage.css'

// Importando a logo para garantir que ela esteja disponível para o print
import logoImg from '../../../logo.png'



function ComandaSummary({ comandaId, onFinalize }) {
    const { orders, total, status, loading } = useComanda(comandaId)

    if (loading || !orders.length) return null

    return (
        <div className="v4-comanda-summary-compact">
            <div className="comanda-header-compact">
                <Receipt size={16} color="var(--cor-primaria)" />
                <span className="comanda-title">TOTAL DA COMANDA: <strong>{formatCurrency(total)}</strong></span>
                <span className={`comanda-status-pill ${status}`}>
                    {status === 'fechamento_solicitado' ? 'SOLICITOU FECHAMENTO' :
                        status === 'paga' ? 'PAGO' : 'ABERTA'}
                </span>
            </div>

            {status !== 'paga' && (
                <button
                    className="btn-finalize-comanda-compact"
                    onClick={() => onFinalize(comandaId)}
                >
                    <Check size={16} /> CONFIRMAR PAGAMENTO TOTAL
                </button>
            )}
        </div>
    )
}

const STAGES = [
    { id: 'confirmado', label: 'Recebido', icon: AlertCircle, color: '#FBBF24', next: 'preparando', nextLabel: 'Iniciar Preparo' },
    { id: 'preparando', label: 'Preparando', icon: Utensils, color: '#8B5CF6', next: 'saiu_entrega', nextLabel: 'Entregador a caminho' },
    { id: 'saiu_entrega', label: 'Saiu para Entrega', icon: Bike, color: '#F59E0B', next: 'entregue', nextLabel: 'Finalizar Pedido' },
    { id: 'entregue', label: 'Servido / Finalizado', icon: CheckCircle2, color: '#10B981' }
]

// Valid transitions for drag-and-drop (all directions allowed for admin flexibility)
const ALL_STAGES = ['confirmado', 'preparando', 'saiu_entrega', 'entregue']
const VALID_TRANSITIONS = Object.fromEntries(
    ALL_STAGES.map(stage => [stage, ALL_STAGES.filter(s => s !== stage)])
)

// Helper: build display name including variation (e.g. "Espetinho de Carne - Só a Carne")
const getItemDisplayName = (item) => {
    return getSmartItemName(
        item.produtos?.nome,
        item.variacoes_produto?.nome,
        item.personalizacao
    )
}

export default function OrdersPage() {
    const { finalizeComanda } = useOrders()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeStage, setActiveStage] = useState('confirmado')
    const [allDrivers, setAllDrivers] = useState([])
    const [error, setError] = useState(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date()
        return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    })
    const dateInputRef = useRef(null)
    const audioRef = useRef(new Audio('/notificacao.mp3'))
    const selectedOrderRef = useRef(null)
    const inFlightRef = useRef(new Set()) // Guards concurrent updates
    const [comandaToFinalize, setComandaToFinalize] = useState(null)
    const [orderToCancel, setOrderToCancel] = useState(null)
    const ordersRef = useRef(orders) // Always-fresh orders reference
    const lastFetchTimeRef = useRef(0) // Cooldown: prevents rapid-fire fetches
    const pendingFetchTimerRef = useRef(null) // Debounce: coalesces multiple realtime events
    const selectedDateRef = useRef(selectedDate) // Stable ref for realtime callback
    const audioUnlockedRef = useRef(false) // Tracks if browser audio policy has been unlocked
    const [autoPrint, setAutoPrint] = useState(() => {
        return localStorage.getItem('espetinho_auto_print') === 'true'
    })
    const autoPrintRef = useRef(autoPrint)

    useEffect(() => {
        ordersRef.current = orders
    }, [orders])

    useEffect(() => {
        selectedOrderRef.current = selectedOrder
    }, [selectedOrder])

    useEffect(() => {
        selectedDateRef.current = selectedDate
    }, [selectedDate])

    useEffect(() => {
        autoPrintRef.current = autoPrint
    }, [autoPrint])

    const toggleAutoPrint = () => {
        setAutoPrint(prev => {
            const next = !prev
            localStorage.setItem('espetinho_auto_print', next)
            return next
        })
    }

    // Auto-print: fetch order, render #thermal-receipt, window.print() — SAME as manual
    const autoPrintOrder = async (orderId) => {
        try {
            const { data: order, error } = await supabase
                .from('pedidos')
                .select(`
                    *,
                    itens:itens_pedido(
                        *,
                        produtos(nome),
                        variacoes_produto(nome)
                    ),
                    clientes(telefone, nome)
                `)
                .eq('id', orderId)
                .single()

            if (error || !order) {
                console.error('[AutoPrint] Erro ao buscar pedido:', error)
                return
            }

            // Set selectedOrder — React renders #thermal-receipt (exact same component as manual print)
            setSelectedOrder(order)

            // Wait for React to render
            await new Promise(resolve => setTimeout(resolve, 400))

            // Clone receipt into body, hide #root, print, restore — same as manual
            const receipt = document.getElementById('thermal-receipt')
            if (receipt) {
                const clone = receipt.cloneNode(true)
                clone.id = 'thermal-receipt-print'
                document.body.appendChild(clone)
                const root = document.getElementById('root')
                root.style.display = 'none'
                window.print()
                root.style.display = ''
                clone.remove()
            }

            // After print dialog closes, clear selectedOrder
            setTimeout(() => {
                setSelectedOrder(null)
            }, 1000)

            console.log('[AutoPrint] Imprimindo pedido #' + order.numero_pedido)
        } catch (err) {
            console.error('[AutoPrint] Erro:', err)
        }
    }


    const playNotificationSound = useCallback(() => {
        const audio = audioRef.current
        audio.currentTime = 0
        audio.play().catch(() => {
            // Browser blocked autoplay — register a one-time click listener to unlock
            if (!audioUnlockedRef.current) {
                const unlock = () => {
                    audioRef.current.play().catch(() => { })
                    audioUnlockedRef.current = true
                    document.removeEventListener('click', unlock)
                    document.removeEventListener('touchstart', unlock)
                }
                document.addEventListener('click', unlock, { once: true })
                document.addEventListener('touchstart', unlock, { once: true })
            }
        })
    }, [])

    // Debounced fetch: coalesces multiple realtime events into one fetch
    // Uses a ref so the realtime subscription never needs to re-subscribe
    const scheduleFetchRef = useRef(null)
    scheduleFetchRef.current = (delayMs = 800) => {
        const elapsed = Date.now() - lastFetchTimeRef.current
        const cooldown = 1000 // Minimum 1s between fetches (reduced from 3s)
        const actualDelay = elapsed < cooldown ? Math.max(delayMs, cooldown - elapsed) : delayMs

        if (pendingFetchTimerRef.current) {
            clearTimeout(pendingFetchTimerRef.current)
        }
        pendingFetchTimerRef.current = setTimeout(() => {
            pendingFetchTimerRef.current = null
            fetchOrders(true)
        }, actualDelay)
    }

    // Initial fetch on date change
    useEffect(() => {
        fetchOrders()
        fetchAllDrivers()
    }, [selectedDate])

    // Realtime subscription — created ONCE, never re-subscribes
    useEffect(() => {
        const channel = supabase
            .channel('orders_admin_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
                console.log('[Realtime] Order event:', payload.eventType, payload.new?.id || payload.old?.id)

                if (payload.eventType === 'INSERT') {
                    console.log('[Realtime] New order detected, playing sound and scheduling fetch...')
                    playNotificationSound()
                    scheduleFetchRef.current?.(800)

                    // Auto-print if enabled (skip table orders)
                    if (autoPrintRef.current && payload.new?.id && payload.new?.tipo_pedido !== 'mesa') {
                        setTimeout(() => autoPrintOrder(payload.new.id), 2500)
                    }
                }

                if (payload.eventType === 'UPDATE') {
                    const orderId = payload.new.id
                    const oldOrder = ordersRef.current.find(o => o.id === orderId)

                    // If this order is currently being updated by US, skip the realtime merge
                    if (inFlightRef.current.has(orderId)) {
                        console.log('[Realtime] Skipping merge for in-flight order:', orderId)
                        return
                    }

                    // Sound highlights for specific comanda events
                    const isNewItemAdded = payload.new.valor_total > (oldOrder?.valor_total || 0)
                    const isClosingRequested = payload.new.comanda_status === 'fechamento_solicitado' && oldOrder?.comanda_status !== 'fechamento_solicitado'

                    if (isNewItemAdded || isClosingRequested) {
                        console.log('[Realtime] Comanda event detected, playing sound...')
                        playNotificationSound()
                    }

                    // Merged orders for comanda: if status moves back to 'confirmado' OR total changes,
                    // we likely have new items that payload.new doesn't include.
                    const needsFullFetch = payload.new.status === 'confirmado' || isNewItemAdded || isClosingRequested

                    if (needsFullFetch) {
                        console.log('[Realtime] Order updated, scheduling debounced fetch...')
                        scheduleFetchRef.current?.(800)
                        return
                    }

                    // Merge the update from another client or from server confirmation
                    setOrders(prev => prev.map(order =>
                        order.id === orderId ? { ...order, ...payload.new } : order
                    ))

                    // Sync selected order modal if open
                    if (selectedOrderRef.current && orderId === selectedOrderRef.current.id) {
                        setOrders(currentOrders => {
                            const updated = currentOrders.find(o => o.id === orderId)
                            if (updated) setSelectedOrder(updated)
                            return currentOrders
                        })
                    }
                }

                if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(order => order.id !== payload.old.id))
                }
            })
            .subscribe((status) => {
                console.log('[Realtime] Subscription status:', status)
            })

        // Polling backup: safety net every 30s in case WebSocket dies silently
        const pollingInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                console.log('[Polling] Heartbeat fetch...')
                fetchOrders(true)
            }
        }, 30000)

        return () => {
            if (pendingFetchTimerRef.current) clearTimeout(pendingFetchTimerRef.current)
            clearInterval(pollingInterval)
            supabase.removeChannel(channel)
        }
    }, []) // Empty deps — channel created ONCE, uses refs for fresh data

    // Wake-from-sleep recovery: reset stuck guards + re-fetch data
    useVisibilityRefresh(useCallback(() => {
        console.log('[OrdersPage] Woke from sleep — recovering...')
        // Reset the fetch guard in case it was stuck mid-flight during sleep
        isFetchingRef.current = false
        lastFetchTimeRef.current = 0 // Allow immediate fetch on wake
        // Re-fetch orders silently (won't show loading spinner)
        fetchOrders(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]))

    const isFetchingRef = useRef(false)

    async function fetchOrders(isSilent = false) {
        // Guard against overlapping fetches
        if (isFetchingRef.current) {
            console.log('[Orders] Fetch already in progress, skipping...')
            return
        }

        // Cooldown guard: prevent rapid-fire fetches
        const now = Date.now()
        if (isSilent && (now - lastFetchTimeRef.current) < 1000) {
            console.log('[Orders] Cooldown active, skipping silent fetch')
            return
        }

        isFetchingRef.current = true

        if (!isSilent) {
            setLoading(true)
            setError(null)
        } else if (isSilent) {
            setIsRefreshing(true)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        try {
            // Use selectedDate to compute midnight boundary
            const [year, month, day] = selectedDate.split('-').map(Number)
            const spDate = new Date(year, month - 1, day, 0, 0, 0, 0)
            const midnightISO = spDate.toISOString()

            // End of day for filtering (next day midnight)
            const endDate = new Date(year, month - 1, day + 1, 0, 0, 0, 0)
            const endISO = endDate.toISOString()

            const { data, error: ordersErr } = await supabase
                .from('pedidos')
                .select(`
                    *,
                    itens:itens_pedido(
                        *,
                        produtos(nome),
                        variacoes_produto(nome)
                    ),
                    clientes(telefone, nome)
                `)
                .gte('criado_em', midnightISO)
                .lt('criado_em', endISO)
                .order('criado_em', { ascending: true })
                .abortSignal(controller.signal)

            clearTimeout(timeoutId)

            if (ordersErr) throw ordersErr

            setOrders(data || [])

            if (isSilent) setError(null) // Clear errors on successful silent refresh
        } catch (err) {
            if (err?.name === 'AbortError') {
                console.warn('[Orders] Fetch timeout — request aborted after 15s')
                if (!isSilent) setError('A conexão demorou demais. Tente atualizar.')
            } else {
                console.error('[Orders] Erro ao carregar pedidos:', err)
                if (!isSilent) setError('Não foi possível carregar os pedidos.')
            }
        } finally {
            isFetchingRef.current = false
            lastFetchTimeRef.current = Date.now()
            setLoading(false)
            setIsRefreshing(false)
            clearTimeout(timeoutId)
        }
    }

    async function fetchAllDrivers() {
        try {
            const { data, error: driversErr } = await supabase.from('entregadores').select('id, nome').eq('ativo', true)
            if (driversErr) throw driversErr
            if (data) setAllDrivers(data)
        } catch (err) {
            console.error('[Orders] Erro ao carregar entregadores:', err)
        }
    }

    const handleAssignDriver = async (orderId, driverId) => {
        const { error } = await supabase
            .from('pedidos')
            .update({ entregador_id: driverId })
            .eq('id', orderId)

        if (!error) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, entregador_id: driverId } : o))
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => ({ ...prev, entregador_id: driverId }))
            }
        }
    }


    const handleStatusChange = async (orderId, newStatus) => {
        // 1. Find current order and validate
        const currentOrder = ordersRef.current.find(o => o.id === orderId)
        if (!currentOrder) return

        // 2. Skip if already at the target status
        if (currentOrder.status === newStatus) {
            console.log('[Kanban] Skip: order already at status', newStatus)
            return
        }

        // 3. Concurrency guard — reject if this order is already being updated
        if (inFlightRef.current.has(orderId)) {
            console.log('[Kanban] Skip: order', orderId, 'update already in-flight')
            return
        }

        // 4. Mark as in-flight
        inFlightRef.current.add(orderId)

        const previousOrders = [...ordersRef.current]
        const now = new Date().toISOString()

        // 5. Optimistic update
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

            // DB write succeeded — use the FRESH order data for side-effects
            const freshOrder = ordersRef.current.find(o => o.id === orderId)

            if (newStatus === 'saiu_entrega' && freshOrder) {
                // Push notification via OneSignal Edge Function (ONLY for delivery orders)
                if (freshOrder.tipo_pedido === 'entrega') {
                    try {
                        const enderecoBairro = typeof freshOrder.endereco === 'object' ? (freshOrder.endereco?.bairro || '') : ''
                        await supabase.functions.invoke('notify-driver', {
                            body: {
                                numero_pedido: freshOrder.numero_pedido,
                                nome_cliente: freshOrder.nome_cliente || freshOrder.clientes?.nome || 'Cliente',
                                endereco_bairro: enderecoBairro,
                                valor_total: freshOrder.valor_total,
                                tipo_notificacao: 'pedido_pronto'
                            }
                        })
                    } catch (notifyErr) {
                        console.error('Erro ao enviar push notification:', notifyErr)
                    }
                }

                // Existing webhook
                try {
                    await fetch('https://espetinho-n8n-webhook.e2u8y7.easypanel.host/webhook/saiu_entrega', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order_id: freshOrder.id,
                            numero_pedido: freshOrder.numero_pedido,
                            status: newStatus,
                            tipo_pedido: freshOrder.tipo_pedido,
                            telefone_contato: freshOrder.telefone_cliente || freshOrder.clientes?.telefone,
                            cliente: {
                                id: freshOrder.cliente_id,
                                nome: freshOrder.clientes?.nome || freshOrder.nome_cliente,
                                telefone_db: freshOrder.clientes?.telefone,
                                whatsapp_contato: freshOrder.clientes?.whatsapp || freshOrder.telefone_cliente,
                            },
                            endereco: freshOrder.endereco,
                            valor_total: freshOrder.valor_total,
                            itens: freshOrder.itens?.map(item => ({
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

            // AUTO-PAY: When mesa orders are completed (entregue), automatically mark as paid
            if (newStatus === 'entregue' && freshOrder?.tipo_pedido === 'mesa') {
                try {
                    await supabase
                        .from('pedidos')
                        .update({ pago: true, comanda_status: 'fechada' })
                        .eq('id', orderId)
                    // Update local state too
                    setOrders(prev => prev.map(o =>
                        o.id === orderId ? { ...o, pago: true, comanda_status: 'fechada' } : o
                    ))
                    console.log('[Auto-Pay] Mesa order', orderId, 'automatically marked as paid')
                } catch (payErr) {
                    console.error('[Auto-Pay] Error marking mesa as paid:', payErr)
                }
            }
        } catch (error) {
            console.error('Erro ao atualizar status:', error)
            setOrders(previousOrders)
            alert('Erro ao atualizar status do pedido. Tente novamente.')
        } finally {
            // 6. Release the concurrency guard
            inFlightRef.current.delete(orderId)
        }
    }

    const handleCancelOrder = async (orderId) => {
        const previousOrders = [...ordersRef.current]
        setOrders(prev => prev.filter(o => o.id !== orderId))
        if (selectedOrder?.id === orderId) setSelectedOrder(null)

        try {
            const { error } = await supabase
                .from('pedidos')
                .delete()
                .eq('id', orderId)

            if (error) throw error
        } catch (error) {
            console.error('Erro ao cancelar pedido:', error)
            setOrders(previousOrders)
            alert('Erro ao cancelar pedido. Tente novamente.')
        }
    }

    const handlePrint = () => {
        const receipt = document.getElementById('thermal-receipt')
        if (!receipt) return
        const clone = receipt.cloneNode(true)
        clone.id = 'thermal-receipt-print'
        document.body.appendChild(clone)
        const root = document.getElementById('root')
        root.style.display = 'none'
        window.print()
        root.style.display = ''
        clone.remove()
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
        if (!orderId) return

        // Validate: find the order and check if this is a valid forward transition
        const order = ordersRef.current.find(o => o.id === orderId)
        if (!order) return
        if (order.status === targetStage) return // Same column — do nothing

        const allowed = VALID_TRANSITIONS[order.status] || []
        if (!allowed.includes(targetStage)) {
            console.log('[Kanban] Invalid transition:', order.status, '→', targetStage)
            return
        }

        handleStatusChange(orderId, targetStage)
    }

    // Touch Support for Kanban dragging
    const touchInfo = useRef({
        orderId: null,
        ghost: null,
        rafId: null,
        currentX: 0,
        currentY: 0,
        lastCheckX: 0,
        lastCheckY: 0
    })

    const onTouchStart = (e, orderId) => {
        const touch = e.touches[0]
        const card = e.currentTarget
        const rect = card.getBoundingClientRect()

        // Cache initial values
        touchInfo.current = {
            orderId,
            startX: touch.clientX,
            startY: touch.clientY,
            offsetX: touch.clientX - rect.left,
            offsetY: touch.clientY - rect.top,
            card: card,
            ghost: null,
            rafId: null,
            currentX: touch.clientX,
            currentY: touch.clientY,
            lastCheckX: touch.clientX,
            lastCheckY: touch.clientY
        }

        // Create ghost/clone for dragging feedback
        const ghost = card.cloneNode(true)
        ghost.style.position = 'fixed'
        ghost.style.top = '0'
        ghost.style.left = '0'
        ghost.style.width = rect.width + 'px'
        ghost.style.opacity = '0.9'
        ghost.style.pointerEvents = 'none'
        ghost.style.zIndex = '10001'
        ghost.style.boxShadow = '0 15px 35px rgba(0,0,0,0.15)'
        ghost.style.transition = 'none' // Disable transitions for fluidity
        ghost.style.willChange = 'transform'
        // Initial position
        ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`

        ghost.classList.add('dragging-ghost')
        document.body.appendChild(ghost)
        touchInfo.current.ghost = ghost

        card.classList.add('touch-dragging')

        // Start animation loop
        const updateGhostPosition = () => {
            if (!touchInfo.current.ghost) return

            const { currentX, currentY, offsetX, offsetY, ghost } = touchInfo.current
            ghost.style.transform = `translate3d(${currentX - offsetX}px, ${currentY - offsetY}px, 0)`

            // Throttled drop target detection (only if moved significantly)
            const { lastCheckX, lastCheckY } = touchInfo.current
            if (Math.abs(currentX - lastCheckX) > 10 || Math.abs(currentY - lastCheckY) > 10) {
                const targetElement = document.elementFromPoint(currentX, currentY)
                const column = targetElement?.closest('.kanban-col')

                document.querySelectorAll('.kanban-col').forEach(col => col.classList.remove('drop-active'))
                if (column) column.classList.add('drop-active')

                touchInfo.current.lastCheckX = currentX
                touchInfo.current.lastCheckY = currentY
            }

            touchInfo.current.rafId = requestAnimationFrame(updateGhostPosition)
        }

        touchInfo.current.rafId = requestAnimationFrame(updateGhostPosition)
    }

    const onTouchMove = (e) => {
        if (!touchInfo.current.ghost) return
        const touch = e.touches[0]

        // Only update coords, RAF handles the move
        touchInfo.current.currentX = touch.clientX
        touchInfo.current.currentY = touch.clientY

        // Prevent scrolling while dragging
        if (e.cancelable) e.preventDefault()
    }

    const onTouchEnd = (e) => {
        if (!touchInfo.current.ghost) return
        const touch = e.changedTouches[0]
        const { rafId, ghost, card } = touchInfo.current

        if (rafId) cancelAnimationFrame(rafId)
        if (ghost) ghost.remove()

        card.classList.remove('touch-dragging')
        document.querySelectorAll('.kanban-col').forEach(col => col.classList.remove('drop-active'))

        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY)
        const column = targetElement?.closest('.kanban-col')

        touchInfo.current = { orderId: null, ghost: null, rafId: null }
        return column // Return column for the inline handler
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

    if (error) {
        return (
            <div className="admin-error-state">
                <Clock size={48} />
                <h3>Erro de sincronização</h3>
                <p>{error}</p>
                <button onClick={() => fetchOrders()} className="btn-retry">
                    <RefreshCw size={18} />
                    Recarregar Pedidos
                </button>
            </div>
        )
    }

    return (
        <div className="orders-kanban-wrapper animate-fade-in">
            <header className="orders-header-premium" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Gerenciamento de Pedidos</h2>
                    <div className="search-box">
                        <Search size={20} color="#94A3B8" />
                        <input
                            type="text"
                            placeholder="Buscar pedido ou cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                        onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', color: '#475569', cursor: 'pointer' }}
                    >
                        <Calendar size={16} />
                        <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {(() => {
                                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                                const [y, m, d] = selectedDate.split('-').map(Number)
                                const dateObj = new Date(y, m - 1, d)
                                if (selectedDate === today) {
                                    return `Hoje, ${dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                                }
                                return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                            })()}
                        </span>
                        <input
                            type="date"
                            ref={dateInputRef}
                            value={selectedDate}
                            onChange={(e) => {
                                if (e.target.value) setSelectedDate(e.target.value)
                            }}
                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        />
                    </div>

                    <button
                        className="btn-refresh-kanban"
                        onClick={() => fetchOrders(true)} // true forces a clear+fetch
                        disabled={isRefreshing}
                        title="Atualizar Pedidos"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                    </button>

                    <button className="btn-sound-test" onClick={playNotificationSound}>
                        <Play size={16} />
                        Ativar Som
                    </button>

                    <button
                        className={`btn-auto-print ${autoPrint ? 'active' : ''}`}
                        onClick={toggleAutoPrint}
                        title={autoPrint ? 'Impressão automática ativada' : 'Impressão automática desativada'}
                    >
                        <Printer size={18} />
                        Impressão Auto
                    </button>
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
                                data-stage={stage.id}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDrop(e, stage.id)}
                            >
                                <div className="col-header">
                                    <div className="header-label">
                                        <h3>{stage.id === 'entregue' && selectedOrder?.tipo_pedido === 'mesa' ? 'Servido' : stage.label}</h3>
                                        <span className="order-count">{stageOrders.length}</span>
                                    </div>
                                    <MoreHorizontal size={20} color="#94A3B8" style={{ cursor: 'pointer' }} />
                                </div>

                                <div className="cards-stack">
                                    {stageOrders.map(order => (
                                        <div
                                            key={order.id}
                                            draggable
                                            onDragStart={(e) => onDragStart(e, order.id)}
                                            onDragEnd={onDragEnd}
                                            onTouchStart={(e) => onTouchStart(e, order.id)}
                                            onTouchMove={onTouchMove}
                                            onTouchEnd={(e) => {
                                                const touch = e.changedTouches[0]
                                                const targetElement = document.elementFromPoint(touch.clientX, touch.clientY)
                                                const column = targetElement?.closest('.kanban-col')
                                                if (column) {
                                                    const targetStage = column.getAttribute('data-stage')
                                                    if (targetStage && targetStage !== order.status) {
                                                        const allowed = VALID_TRANSITIONS[order.status] || []
                                                        if (allowed.includes(targetStage)) {
                                                            handleStatusChange(order.id, targetStage)
                                                        }
                                                    }
                                                }
                                                onTouchEnd(e)
                                            }}
                                            className={`order-card-v2 ${(order.status === 'preparando' || order.status === 'pronto') ? 'border-purple' : order.status === 'saiu_entrega' ? 'border-orange' : order.status === 'entregue' ? 'border-green' : ''}`}
                                            onClick={() => setSelectedOrder(order)}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <span className={`type-tag ${order.tipo_pedido}`}>
                                                    {order.tipo_pedido === 'entrega' ? <Bike size={12} /> : order.tipo_pedido === 'mesa' ? <Utensils size={12} /> : <Store size={12} />}
                                                    {order.tipo_pedido === 'mesa' ? order.nome_cliente : order.tipo_pedido}
                                                </span>
                                                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Timer size={12} />
                                                    <span>{getMinutesAgo(order.criado_em)} min atrás</span>
                                                </div>
                                            </div>

                                            <div className="card-title-group">
                                                <span className="order-id">PEDIDO - {order.numero_pedido}</span>
                                                <h4 className="customer-name-v2">Cliente: {order.nome_cliente || 'Sem nome'}</h4>
                                            </div>

                                            <div className="items-preview" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {order.itens?.map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                        <span style={{ fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' }}>{item.quantidade}x </span>
                                                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{getItemDisplayName(item)}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f8fafc' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button
                                                        className="btn-cancel-card"
                                                        title="Cancelar pedido"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setOrderToCancel(order)
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{formatCurrency(order.valor_total)}</span>
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {stage.next && (
                                                        <button
                                                            className={`quick-action stage-${stage.next}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const nextStatus = (order.tipo_pedido === 'mesa' && stage.id === 'preparando') ? 'entregue' : stage.next;
                                                                handleStatusChange(order.id, nextStatus);
                                                            }}
                                                        >
                                                            {
                                                                stage.id === 'confirmado' ? 'Iniciar' :
                                                                    stage.id === 'preparando' ? (order.tipo_pedido === 'mesa' ? 'Servir' : 'Enviar') :
                                                                        stage.id === 'saiu_entrega' ? 'Concluir' : 'Iniciar'
                                                            }
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {
                selectedOrder && (
                    <>
                        <div className="modal-overlay-v4" onClick={() => setSelectedOrder(null)}>
                            <div className="modal-kitchen-v4" onClick={e => e.stopPropagation()}>
                                {/* NEW PREMIUM HEADER */}
                                <header className="modal-v5-header">
                                    <div className="header-title-group">
                                        <div className="header-icon-box">
                                            <ReceiptText size={20} />
                                        </div>
                                        <div className="header-text">
                                            <h2>Detalhes do Pedido</h2>
                                            <p>Espetinho Vitória</p>
                                        </div>
                                    </div>
                                    <button className="btn-close-v5" onClick={() => setSelectedOrder(null)}>
                                        <X size={24} />
                                    </button>
                                </header>

                                {/* SUMMARY SECTION */}
                                <div className="modal-v5-summary">
                                    <div className="summary-main">
                                        <div className="summary-id-group">
                                            <div className="summary-id-row">
                                                <h3>Pedido {selectedOrder.numero_pedido}</h3>
                                                <div className={`status-badge-v5 ${selectedOrder.status}`}>
                                                    <Timer size={14} />
                                                    {selectedOrder.status === 'confirmado' ? 'Confirmado' :
                                                        selectedOrder.status === 'preparando' ? 'Em Preparo' :
                                                            selectedOrder.status === 'saiu_entrega' ? 'Em Entrega' : 'Entregue'}
                                                </div>
                                            </div>
                                            <p className="summary-meta">
                                                {new Date(selectedOrder.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {new Date(selectedOrder.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Cliente: {selectedOrder.nome_cliente} • {selectedOrder.tipo_pedido?.toUpperCase()}
                                            </p>
                                        </div>

                                        <div className="summary-actions">
                                            <button className="btn-v5-secondary" onClick={handlePrint}>
                                                <Printer size={18} />
                                                Imprimir
                                            </button>

                                            {selectedOrder.status === 'confirmado' && (
                                                <button className="btn-v5-primary" onClick={() => {
                                                    handleStatusChange(selectedOrder.id, 'preparando');
                                                    setSelectedOrder(null);
                                                }}>
                                                    <ChefHat size={18} />
                                                    Mandar p/ Cozinha
                                                </button>
                                            )}

                                            {selectedOrder.status === 'preparando' && (
                                                <button className="btn-v5-primary" onClick={() => {
                                                    handleStatusChange(selectedOrder.id, selectedOrder.tipo_pedido === 'mesa' ? 'entregue' : 'saiu_entrega');
                                                    setSelectedOrder(null);
                                                }}>
                                                    <Bike size={18} />
                                                    {selectedOrder.tipo_pedido === 'mesa' ? 'Servir Pedido' : 'Enviar'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* BODY SECTION (ITEMS) */}
                                <div className="modal-v5-body">
                                    <h3 className="items-section-title">Itens do Pedido ({selectedOrder.itens?.length || 0})</h3>
                                    <div className="v5-items-list">
                                        {selectedOrder.itens?.map((item, idx) => (
                                            <div key={idx} className="v5-item-row">
                                                <div className="v5-item-main">
                                                    <div className="v5-item-icon">
                                                        {item.produtos?.categoria?.nome?.toLowerCase()?.includes('bebida') ? <GlassWater size={20} /> :
                                                            item.produtos?.categoria?.nome?.toLowerCase()?.includes('açai') ? <IceCreamCone size={20} /> : <UtensilsCrossed size={20} />}
                                                    </div>
                                                    <div className="v5-item-info">
                                                        <h4>{item.quantidade}x {getItemDisplayName(item)}</h4>
                                                        <p>
                                                            {item.personalizacao && typeof item.personalizacao === 'object' && filterPersonalizacao(item.personalizacao, getItemDisplayName(item)).map(p => `${p.key}: ${p.value}`).join(', ')}
                                                        </p>
                                                        {item.observacoes && (
                                                            <p className="v5-item-obs">Obs: {item.observacoes}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="v5-item-price">{formatCurrency(item.preco_unitario * item.quantidade)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedOrder.observacoes && (
                                        <div style={{ marginTop: '24px', padding: '16px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase' }}>Observações Gerais</p>
                                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#b91c1c' }}>{selectedOrder.observacoes}</p>
                                        </div>
                                    )}

                                    {selectedOrder.tipo_pedido === 'entrega' && selectedOrder.endereco && (
                                        <div style={{ marginTop: '24px', padding: '20px', background: '#f1f5f9', borderRadius: '14px' }}>
                                            <p style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Endereço de Entrega</p>
                                            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: '600', color: '#475569', lineHeight: '1.4' }}>
                                                {typeof selectedOrder.endereco === 'string'
                                                    ? selectedOrder.endereco
                                                    : `${selectedOrder.endereco.rua}, ${selectedOrder.endereco.numero} - ${selectedOrder.endereco.bairro}`}
                                            </p>
                                            {selectedOrder.endereco.referencia && (
                                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>Ref: {selectedOrder.endereco.referencia}</p>
                                            )}


                                        </div>
                                    )}
                                </div>

                                {/* FOOTER SECTION */}
                                <div className="modal-v5-footer">
                                    <div className="v5-totals">
                                        <div className="v5-total-line">
                                            <span>Subtotal</span>
                                            <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                        </div>
                                        {selectedOrder.taxa_entrega > 0 && (
                                            <div className="v5-total-line">
                                                <span>Taxa de Entrega</span>
                                                <span>{formatCurrency(selectedOrder.taxa_entrega)}</span>
                                            </div>
                                        )}
                                        <div className="v5-total-final">
                                            <span>Total do Pedido</span>
                                            <span className="amount">{formatCurrency(selectedOrder.valor_total)}</span>
                                        </div>
                                    </div>

                                    <div className="v5-footer-actions">
                                        <button className="btn-v5-cancel" onClick={() => setOrderToCancel(selectedOrder)}>
                                            <XCircle size={20} />
                                            CANCELAR PEDIDO
                                        </button>

                                        {selectedOrder.status === 'saiu_entrega' ? (
                                            <button className="btn-v5-finish" onClick={() => {
                                                handleStatusChange(selectedOrder.id, 'entregue');
                                                setSelectedOrder(null);
                                            }}>
                                                <CheckCircle size={20} />
                                                FINALIZAR ENTREGA
                                            </button>
                                        ) : (
                                            <button className="btn-v5-finish" onClick={() => setSelectedOrder(null)}>
                                                <ArrowRight size={20} />
                                                VOLTAR AO KANBAN
                                            </button>
                                        )}
                                    </div>

                                    {selectedOrder.comanda_id && (
                                        <div style={{ marginTop: '24px' }}>
                                            <ComandaSummary
                                                comandaId={selectedOrder.comanda_id}
                                                onFinalize={(cid) => setComandaToFinalize(cid)}
                                            />
                                        </div>
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
                                    <h2 style={{ fontSize: '22px', fontWeight: '900', textAlign: 'center', margin: '8px 0', textTransform: 'uppercase', borderBottom: '2px dashed #000', paddingBottom: '8px' }}>
                                        {selectedOrder.tipo_pedido === 'entrega'
                                            ? '🚀 ENTREGA'
                                            : selectedOrder.tipo_pedido === 'mesa'
                                                ? (selectedOrder.nome_cliente?.toUpperCase().includes('MESA') ? selectedOrder.nome_cliente?.toUpperCase() : `🍽️ MESA - ${selectedOrder.nome_cliente?.toUpperCase()}`)
                                                : '🛍️ RETIRADA'}
                                    </h2>
                                    <div className="receipt-order-num">PEDIDO #{selectedOrder.numero_pedido}</div>
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
                                                <th style={{ width: '15%' }}>QTD</th>
                                                <th style={{ width: '53%', paddingLeft: '1mm' }}>ITENS</th>
                                                <th style={{ width: '32%', textAlign: 'right' }}>PREÇO</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedOrder.itens?.map((item, i) => (
                                                <tr key={i}>
                                                    <td>{item.quantidade}</td>
                                                    <td>
                                                        <div>{getItemDisplayName(item)?.toUpperCase()}</div>
                                                        {item.personalizacao && typeof item.personalizacao === 'object' && filterPersonalizacao(item.personalizacao, getItemDisplayName(item)).map(({ key, value }) => (
                                                            <div key={key} className="receipt-item-details">
                                                                {key}: {value}
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
                                    <div className="footer">
                                        OBRIGADO PELA PREFERÊNCIA!<br />
                                        ESPETINHO VITÓRIA
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }
            {/* Finalization Dialog */}
            <Dialog
                isOpen={!!comandaToFinalize}
                onClose={() => setComandaToFinalize(null)}
                onConfirm={async () => {
                    const cid = comandaToFinalize
                    setComandaToFinalize(null)
                    try {
                        await finalizeComanda(cid)
                        setSelectedOrder(null)
                        fetchOrders(true) // Silent refresh
                    } catch {
                        alert('Erro ao finalizar comanda.')
                    }
                }}
                title="Confirmar Pagamento?"
                message="Deseja confirmar o pagamento total desta comanda? Todos os pedidos vinculados serão marcados como pagos e concluídos."
            />

            {/* Cancel Order Dialog */}
            <Dialog
                isOpen={!!orderToCancel}
                onClose={() => setOrderToCancel(null)}
                onConfirm={() => {
                    const id = orderToCancel.id
                    setOrderToCancel(null)
                    handleCancelOrder(id)
                }}
                title="Cancelar Pedido?"
                message={`Tem certeza que deseja cancelar o pedido #PED-${orderToCancel?.numero_pedido}? Esta ação não pode ser desfeita e o pedido será excluído permanentemente.`}
            />
        </div >
    )
}
