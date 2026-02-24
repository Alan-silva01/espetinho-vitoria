import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Clock, CheckCircle2, Truck, AlertCircle,
    MoreHorizontal, Phone, MapPin, DollarSign,
    User, ChevronRight, X, Utensils, Timer,
    Store, Bike, Play, Check, Calendar, Search, Bell, Printer, RefreshCw, Receipt
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
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
    const baseName = item.produtos?.nome || 'Item'
    const variationName = item.variacoes_produto?.nome
    if (!variationName) return baseName
    // Strip existing variation from product name if it's already embedded (e.g. "Espetinho de Carne – Completo")
    const cleanBase = baseName.replace(/\s*[-–]\s*(Completo|Com .+|Só .+)$/i, '').trim()
    return `${cleanBase} - ${variationName}`
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
    const ordersRef = useRef(orders) // Always-fresh orders reference
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
        autoPrintRef.current = autoPrint
    }, [autoPrint])

    const toggleAutoPrint = () => {
        setAutoPrint(prev => {
            const next = !prev
            localStorage.setItem('espetinho_auto_print', next)
            return next
        })
    }

    // Auto-print: fetch full order data and print via hidden iframe
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

            const itemDisplayName = (item) => {
                const baseName = item.produtos?.nome || 'Item'
                const variationName = item.variacoes_produto?.nome
                if (!variationName) return baseName
                const cleanBase = baseName.replace(/\s*[-–]\s*(Completo|Com .+|Só .+)$/i, '').trim()
                return `${cleanBase} - ${variationName}`
            }

            const fmtCurrency = (v) => {
                const num = Number(v) || 0
                return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            }

            const tipoLabel = order.tipo_pedido === 'entrega' ? 'ENTREGA PARCEIRA' : order.tipo_pedido === 'mesa' ? order.nome_cliente?.toUpperCase() : 'RETIRADA NA LOJA'
            const dataStr = new Date(order.criado_em).toLocaleDateString('pt-BR')
            const horaStr = new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            let enderecoHTML = ''
            if (order.tipo_pedido === 'entrega' && order.endereco) {
                const end = order.endereco
                const addr = typeof end === 'string' ? end.toUpperCase() : `${end.rua?.toUpperCase()}, ${end.numero}`
                const bairro = end.bairro?.toUpperCase() || ''
                const ref = end.referencia ? `<div>REF: ${end.referencia.toUpperCase()}</div>` : ''
                enderecoHTML = `
                    <div style="border-top:1px dashed black;margin:3mm 0"></div>
                    <div style="text-align:center;font-weight:900;font-size:13px;margin-bottom:2mm">ENDEREÇO DE ENTREGA</div>
                    <div>${addr}</div>
                    <div>${bairro}</div>
                    ${ref}`
            }

            const itensHTML = (order.itens || []).map(item => {
                let details = ''
                if (item.personalizacao && typeof item.personalizacao === 'object') {
                    details += Object.entries(item.personalizacao).map(([k, v]) =>
                        `<div style="font-size:9px;padding-left:1mm">- ${k.toUpperCase()}: ${String(v).toUpperCase()}</div>`
                    ).join('')
                }
                if (item.observacoes) {
                    details += `<div style="font-size:9px;padding-left:1mm;font-weight:bold">* OBS: ${item.observacoes.toUpperCase()}</div>`
                }
                return `<tr>
                    <td>${item.quantidade}</td>
                    <td><div>${itemDisplayName(item)?.toUpperCase()}</div>${details}</td>
                    <td style="text-align:right">${fmtCurrency(item.preco_unitario * item.quantidade)}</td>
                </tr>`
            }).join('')

            let taxaHTML = ''
            if (order.taxa_entrega > 0) {
                taxaHTML = `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:1mm">
                    <span>TAXA DE ENTREGA</span><span>${fmtCurrency(order.taxa_entrega)}</span></div>`
            }

            let trocoHTML = ''
            if (order.troco_para) {
                trocoHTML = `<div style="display:flex;justify-content:space-between;margin-top:2mm">
                    <span style="font-weight:900">TROCO PARA:</span><span>${fmtCurrency(order.troco_para)}</span></div>`
            }

            let obsHTML = ''
            if (order.observacoes) {
                obsHTML = `<div style="border-top:1px dashed black;margin:3mm 0"></div>
                    <div style="text-align:center;font-weight:900;font-size:13px;margin-bottom:2mm">OBSERVAÇÃO GERAL</div>
                    <div style="text-align:center;font-weight:bold">${order.observacoes.toUpperCase()}</div>`
            }

            const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
            <style>
                @page { margin: 0; size: 58mm auto; }
                * { margin:0; padding:0; box-sizing:border-box; }
                body { width:58mm; margin: 0 auto; padding:1mm 1.5mm; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; line-height:1.2; text-transform:uppercase; color:black; overflow:hidden; font-weight:700; }
                .divider { border-top:2px dashed black; margin:2.5mm 0; }
                .section-title { text-align:center; font-weight:900; font-size:14px; margin-bottom:2mm; border:1px solid black; padding:0.5mm; }
                .header-info { text-align:center; margin-bottom:4mm; }
                .order-num { font-size:20px; font-weight:950; margin-bottom:1mm; }
                .data-row { display:flex; justify-content:space-between; margin-bottom:1mm; }
                .label { font-weight:900; }
                table { width:100%; border-collapse:collapse; margin:3mm 0; }
                th { text-align:left; border-bottom:2px solid black; padding-bottom:1mm; font-size:11px; font-weight:900; }
                td { padding:2mm 0; vertical-align:top; font-size:13px; font-weight:800; }
                .total-big { font-size:18px; font-weight:950; margin-top:2.5mm; border-top:2px solid black; padding-top:2.5mm; display:flex; justify-content:space-between; }
                .footer { text-align:center; margin-top:8mm; font-size:12px; padding-bottom:10mm; font-weight:800; }
            </style></head><body>
                <div class="header-info">
                    <div class="order-num">PEDIDO #${order.numero_pedido}</div>
                    <div>${tipoLabel}</div>
                    <div>${dataStr} - ${horaStr}</div>
                </div>
                <div class="divider"></div>
                <div><div class="section-title">ESTABELECIMENTO</div>
                <div style="text-align:center">ESPETINHO VITÓRIA - ESPETOS, AÇAÍ E CALDOS</div></div>
                <div class="divider"></div>
                <div><div class="section-title">CLIENTE</div>
                <div class="data-row"><span class="label">NOME:</span><span>${order.nome_cliente?.toUpperCase() || 'N/A'}</span></div>
                <div class="data-row"><span class="label">TEL:</span><span>${order.telefone_cliente || order.clientes?.telefone || 'N/A'}</span></div></div>
                ${enderecoHTML}
                <div class="divider"></div>
                <div><div class="section-title">ITENS DO PEDIDO</div>
                <table><thead><tr><th style="width:10%">QTD</th><th style="width:65%">ITENS</th><th style="width:25%;text-align:right">PREÇO</th></tr></thead>
                <tbody>${itensHTML}</tbody></table></div>
                <div class="divider"></div>
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:1mm">
                        <span>ITENS DO PEDIDO</span><span>${fmtCurrency(order.subtotal)}</span></div>
                    ${taxaHTML}
                    <div class="total-big"><span>TOTAL</span><span>${fmtCurrency(order.valor_total)}</span></div>
                </div>
                <div class="divider"></div>
                <div><div class="section-title">FORMA DE PAGAMENTO</div>
                <div class="data-row"><span>${order.forma_pagamento?.toUpperCase()}</span><span>${fmtCurrency(order.valor_total)}</span></div>
                ${trocoHTML}</div>
                ${obsHTML}
                <div class="footer">OBRIGADO PELA PREFERÊNCIA!<br>ESPETINHO VITÓRIA</div>
            </body></html>`

            // Print via hidden iframe
            const iframe = document.createElement('iframe')
            iframe.style.position = 'fixed'
            iframe.style.top = '-10000px'
            iframe.style.left = '-10000px'
            iframe.style.width = '58mm'
            iframe.style.height = '0'
            document.body.appendChild(iframe)

            iframe.contentDocument.open()
            iframe.contentDocument.write(receiptHTML)
            iframe.contentDocument.close()

            // Wait for content to render then print
            iframe.onload = () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow.print()
                    } catch (e) {
                        console.error('[AutoPrint] Print failed:', e)
                    }
                    // Cleanup after print dialog closes
                    setTimeout(() => {
                        document.body.removeChild(iframe)
                    }, 2000)
                }, 300)
            }

            console.log('[AutoPrint] Imprimindo pedido #' + order.numero_pedido)
        } catch (err) {
            console.error('[AutoPrint] Erro:', err)
        }
    }


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
        fetchAllDrivers()

        const channel = supabase
            .channel('orders_admin_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
                console.log('[Realtime] Order event:', payload.eventType, payload.new?.id || payload.old?.id)

                if (payload.eventType === 'INSERT') {
                    console.log('[Realtime] New order detected, playing sound and fetching...')
                    playNotificationSound()
                    // Increased delay to 1.5s for safer DB propagation
                    setTimeout(() => fetchOrders(true), 1500)

                    // Auto-print if enabled (skip table orders)
                    if (autoPrintRef.current && payload.new?.id && payload.new?.tipo_pedido !== 'mesa') {
                        // Wait for items to be fully saved before printing
                        setTimeout(() => autoPrintOrder(payload.new.id), 2500)
                    }
                }

                if (payload.eventType === 'UPDATE') {
                    const orderId = payload.new.id
                    const oldOrder = ordersRef.current.find(o => o.id === orderId)

                    // If this order is currently being updated by US, skip the realtime merge
                    // to avoid reverting our optimistic update. Our handleStatusChange will
                    // handle the final state.
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
                        console.log('[Realtime] Order updated, re-fetching list...')
                        setTimeout(() => fetchOrders(true), 1500)
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

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedDate])

    // Wake-from-sleep recovery: reset stuck guards + re-fetch data
    useVisibilityRefresh(useCallback(() => {
        console.log('[OrdersPage] Woke from sleep — recovering...')
        // Reset the fetch guard in case it was stuck mid-flight during sleep
        isFetchingRef.current = false
        // Re-fetch orders silently (won't show loading spinner)
        fetchOrders(true)
    }, [selectedDate]))

    const isFetchingRef = useRef(false)

    async function fetchOrders(isSilent = false) {
        // Guard against overlapping fetches
        if (isFetchingRef.current) {
            console.log('[Orders] Fetch already in progress, skipping...')
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
                    await fetch('https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/saiu_entrega', {
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
        } catch (error) {
            console.error('Erro ao atualizar status:', error)
            setOrders(previousOrders)
            alert('Erro ao atualizar status do pedido. Tente novamente.')
        } finally {
            // 6. Release the concurrency guard
            inFlightRef.current.delete(orderId)
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
            <header className="orders-header-premium">
                <div className="header-left">
                    <h1>Gerenciamento de Pedidos</h1>
                    <div className="date-badge date-picker-trigger" onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}>
                        <Calendar size={14} />
                        <span>
                            {(() => {
                                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                                const [y, m, d] = selectedDate.split('-').map(Number)
                                const dateObj = new Date(y, m - 1, d)
                                if (selectedDate === today) {
                                    return `Hoje, ${dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                                }
                                return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                            })()}
                        </span>
                        <input
                            ref={dateInputRef}
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                                if (e.target.value) setSelectedDate(e.target.value)
                            }}
                            className="hidden-date-input"
                        />
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

                    <button
                        className={`btn-auto-print ${autoPrint ? 'active' : ''}`}
                        onClick={toggleAutoPrint}
                        title={autoPrint ? 'Auto-impressão ATIVADA' : 'Auto-impressão DESATIVADA'}
                    >
                        <Printer size={18} />
                        <span>{autoPrint ? 'Auto Print ✓' : 'Auto Print'}</span>
                    </button>

                    <button
                        className={`btn-refresh-kanban ${isRefreshing ? 'refreshing' : ''}`}
                        onClick={() => fetchOrders(true)}
                        disabled={isRefreshing}
                        title="Atualizar Pedidos"
                    >
                        <RefreshCw size={18} />
                        <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
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
                                data-stage={stage.id}
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
                                            <div className="card-top">
                                                <span className="order-id">#PED-{order.numero_pedido}</span>
                                                <span className={`type-tag ${order.tipo_pedido}`}>
                                                    {order.tipo_pedido === 'entrega' ? <Bike size={10} /> : order.tipo_pedido === 'mesa' ? <Utensils size={10} /> : <Store size={10} />}
                                                    {order.tipo_pedido === 'mesa' ? order.nome_cliente : order.tipo_pedido}
                                                </span>
                                                {order.comanda_status === 'fechamento_solicitado' && (
                                                    <span className="closing-alert-badge">
                                                        FECHAR CONTA!
                                                    </span>
                                                )}
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
                                                            <span className="name">{getItemDisplayName(item)}</span>
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
                                                <span className="v4-item-name">{getItemDisplayName(item)}</span>
                                            </div>

                                            {(item.personalizacao || item.observacoes) && (
                                                <div className="v4-item-details">
                                                    {item.personalizacao && typeof item.personalizacao === 'object' && Object.entries(item.personalizacao).map(([k, v]) => {
                                                        const displayVal = Array.isArray(v) ? v.join(', ') : v;
                                                        if (!displayVal) return null;
                                                        return (
                                                            <div key={k} className="v4-detail-row">
                                                                {k}: {String(displayVal)}
                                                            </div>
                                                        );
                                                    })}
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

                                {selectedOrder.tipo_pedido === 'entrega' && (
                                    <div className="v4-driver-assign">
                                        <label>ENTREGADOR:</label>
                                        <select
                                            value={selectedOrder.entregador_id || ''}
                                            onChange={(e) => handleAssignDriver(selectedOrder.id, e.target.value)}
                                        >
                                            <option value="">Não atribuído</option>
                                            {allDrivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
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

                            {selectedOrder.comanda_id && (
                                <div style={{ padding: '0 24px 24px' }}>
                                    <ComandaSummary
                                        comandaId={selectedOrder.comanda_id}
                                        onFinalize={(cid) => setComandaToFinalize(cid)}
                                    />
                                </div>
                            )}
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
                                                    <div>{getItemDisplayName(item)?.toUpperCase()}</div>
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
        </div>
    )
}
