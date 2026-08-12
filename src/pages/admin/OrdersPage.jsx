import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Clock, CheckCircle2, Truck, AlertCircle,
    MoreHorizontal, Phone, MapPin, DollarSign,
    User, ChevronRight, X, Utensils, Timer, Plus,
    Store, Bike, Play, Check, Calendar, Search, Bell, Printer, RefreshCw, Receipt, Trash2,
    ReceiptText, ChefHat, GlassWater, IceCreamCone, UtensilsCrossed, XCircle, CheckCircle, ArrowRight, RotateCcw
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import n8nService from '../../services/n8nService'
import { formatCurrency, filterPersonalizacao, getSmartItemName } from '../../lib/utils'
import { useOrders, useComanda } from '../../hooks/useOrders'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { useNotificationSoundContext } from '../../context/NotificationSoundContext'

import Dialog from '../../components/ui/Dialog'
import CreateOrderModal from '../../components/admin/CreateOrderModal'
import KanbanOrderCard from '../../components/admin/KanbanOrderCard'
import OrderDetailModal from '../../components/admin/OrderDetailModal'
import ThermalReceipt from '../../components/admin/ThermalReceipt'
import './OrdersPage.css'



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
    const { playNotificationSound } = useNotificationSoundContext()
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
    const selectedOrderRef = useRef(null)
    const inFlightRef = useRef(new Set()) // Guards concurrent updates
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [comandaToFinalize, setComandaToFinalize] = useState(null)
    const [orderToCancel, setOrderToCancel] = useState(null)
    const [orderToReactivate, setOrderToReactivate] = useState(null)
    const ordersRef = useRef(orders) // Always-fresh orders reference
    const lastFetchTimeRef = useRef(0) // Cooldown: prevents rapid-fire fetches
    const pendingFetchTimerRef = useRef(null) // Debounce: coalesces multiple realtime events
    const selectedDateRef = useRef(selectedDate) // Stable ref for realtime callback
    const [autoPrint, setAutoPrint] = useState(() => {
        return localStorage.getItem('espetinho_auto_print') === 'true'
    })
    const autoPrintRef = useRef(autoPrint)

    // Controlled clock for "X min atrás" — updates every 30s instead of every render
    const [clockTick, setClockTick] = useState(Date.now())
    useEffect(() => {
        const timer = setInterval(() => setClockTick(Date.now()), 30000)
        return () => clearInterval(timer)
    }, [])

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
                        produtos(nome, opcoes_personalizacao),
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

    // Debounced fetch: coalesces multiple realtime events into one fetch
    // Uses a ref so the realtime subscription never needs to re-subscribe
    const scheduleFetchRef = useRef(null)
    scheduleFetchRef.current = (delayMs = 2000) => {
        const elapsed = Date.now() - lastFetchTimeRef.current
        const cooldown = 5000 // Minimum 5s between fetches (performance optimization)
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

    // Realtime subscription — created ONCE per mount with unique channel ID to prevent leaks
    useEffect(() => {
        const channelName = `orders_admin_realtime_${Math.random().toString(36).substring(2, 9)}`
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
                console.log('[Realtime] Order event:', payload.eventType, payload.new?.id || payload.old?.id)

                if (payload.eventType === 'INSERT') {
                    console.log('[Realtime] New order detected, scheduling fetch (sound handled globally)...')
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

                    // Detect comanda events (sound is handled by useOrderNotificationSound)
                    const isNewItemAdded = payload.new.valor_total > (oldOrder?.valor_total || 0)

                    if (isNewItemAdded) {
                        // New items added to comanda — need to fetch to get new itens_pedido relations
                        console.log('[Realtime] New items detected (valor_total increased), scheduling fetch...')
                        scheduleFetchRef.current?.(1500)
                        return
                    }

                    // For ALL other updates (status change, driver assigned, comanda_status, pago, etc.)
                    // merge payload.new directly — preserves existing relations (itens, clientes, mesas)
                    // This eliminates unnecessary DB queries for the most common realtime events
                    setOrders(prev => {
                        const updatedOrders = prev.map(order =>
                            order.id === orderId ? { ...order, ...payload.new } : order
                        )

                        // Sync selected order modal if open
                        if (selectedOrderRef.current && orderId === selectedOrderRef.current.id) {
                            const updated = updatedOrders.find(o => o.id === orderId)
                            if (updated) {
                                setTimeout(() => {
                                    setSelectedOrder(updated)
                                }, 0)
                            }
                        }

                        return updatedOrders
                    })
                }

                if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(order => order.id !== payload.old.id))
                }
            })
            .subscribe((status) => {
                console.log('[Realtime] Subscription status:', status)
            })

        // Polling backup: safety net every 60s in case WebSocket dies silently
        const pollingInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                console.log('[Polling] Heartbeat fetch...')
                fetchOrders(true)
            }
        }, 60000)

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
    }, [selectedDate]), { sleepThresholdMs: 30_000 })

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
                        produtos(nome, opcoes_personalizacao),
                        variacoes_produto(nome)
                    ),
                    clientes(telefone, nome),
                    mesas(numero)
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

                await n8nService.sendSaiuEntrega({
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
        // Soft-delete: update status to 'cancelado' instead of deleting
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelado' } : o))
        if (selectedOrder?.id === orderId) setSelectedOrder(null)

        try {
            const { error } = await supabase
                .from('pedidos')
                .update({ status: 'cancelado' })
                .eq('id', orderId)

            if (error) throw error
        } catch (error) {
            console.error('Erro ao cancelar pedido:', error)
            setOrders(previousOrders)
            alert('Erro ao cancelar pedido. Tente novamente.')
        }
    }

    const handleReactivateOrder = async (orderId) => {
        const previousOrders = [...ordersRef.current]
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'confirmado' } : o))

        try {
            const { error } = await supabase
                .from('pedidos')
                .update({ status: 'confirmado' })
                .eq('id', orderId)

            if (error) throw error
        } catch (error) {
            console.error('Erro ao reativar pedido:', error)
            setOrders(previousOrders)
            alert('Erro ao reativar pedido. Tente novamente.')
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

    const getMinutesAgo = useCallback((date) => {
        if (!date) return 0
        const diff = clockTick - new Date(date)
        return Math.floor(diff / 60000)
    }, [clockTick])

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesSearch = !searchTerm ||
                order.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.numero_pedido?.toString().includes(searchTerm) ||
                order.itens?.some(item => item.produtos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()))

            return matchesSearch
        })
    }, [orders, searchTerm])

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
            <header className="orders-header-premium" style={{ background: 'white', borderBottom: '1px solid #DFDFDF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#171717', margin: 0, whiteSpace: 'nowrap' }}>Gerenciamento de Pedidos</h2>
                    <div className="search-box">
                        <Search size={15} color="#9CA3AF" />
                        <input
                            type="text"
                            placeholder="Buscar pedido ou cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                        onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F3F4F6', padding: '6px 10px', borderRadius: '8px', color: '#525252', cursor: 'pointer', fontSize: '12px', fontWeight: '600', border: '1px solid #DFDFDF' }}
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
                        <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
                    </button>

                    <button className="btn-sound-test" onClick={playNotificationSound}>
                        <Play size={14} />
                        Ativar Som
                    </button>

                    <button
                        className="btn-new-order-kanban"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        <Plus size={14} /> Novo Pedido
                    </button>

                    <button
                        className={`btn-auto-print ${autoPrint ? 'active' : ''}`}
                        onClick={toggleAutoPrint}
                        title={autoPrint ? 'Impressão automática ativada' : 'Impressão automática desativada'}
                    >
                        <Printer size={14} />
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
                        // Cancelled orders go into the 'entregue' (Concluído) column
                        const stageOrders = stage.id === 'entregue'
                            ? filteredOrders.filter(o => o.status === stage.id || o.status === 'cancelado')
                            : filteredOrders.filter(o => o.status === stage.id)

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
                                </div>

                                <div className="cards-stack">
                                    {stageOrders.map(order => (
                                        <KanbanOrderCard
                                            key={order.id}
                                            order={order}
                                            stage={stage}
                                            getMinutesAgo={getMinutesAgo}
                                            onDragStart={onDragStart}
                                            onDragEnd={onDragEnd}
                                            onTouchStart={onTouchStart}
                                            onTouchMove={onTouchMove}
                                            onTouchEnd={onTouchEnd}
                                            onSelect={setSelectedOrder}
                                            onCancel={setOrderToCancel}
                                            onReactivate={setOrderToReactivate}
                                            onStatusChange={handleStatusChange}
                                            validTransitions={VALID_TRANSITIONS}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {selectedOrder && (
                <>
                    <OrderDetailModal
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onStatusChange={handleStatusChange}
                        onPrint={handlePrint}
                        onCancel={setOrderToCancel}
                        onReactivate={setOrderToReactivate}
                        onFinalizeComanda={setComandaToFinalize}
                        ComandaSummary={ComandaSummary}
                    />
                    <ThermalReceipt order={selectedOrder} />
                </>
            )}
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
                message={`Tem certeza que deseja cancelar o pedido #PED-${orderToCancel?.numero_pedido}? O pedido será marcado como cancelado e movido para a coluna Concluído. Você poderá reativá-lo depois.`}
            />

            {/* Reactivate Order Dialog */}
            <Dialog
                isOpen={!!orderToReactivate}
                onClose={() => setOrderToReactivate(null)}
                onConfirm={() => {
                    const id = orderToReactivate.id
                    setOrderToReactivate(null)
                    handleReactivateOrder(id)
                }}
                title="Reativar Pedido?"
                message={`Deseja reativar o pedido #PED-${orderToReactivate?.numero_pedido}? Ele voltará para a coluna Recebido e entrará no fluxo normal.`}
            />

            {/* Create Order Modal */}
            <CreateOrderModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onOrderCreated={() => {
                    fetchOrders(true)
                }}
            />
        </div >
    )
}
