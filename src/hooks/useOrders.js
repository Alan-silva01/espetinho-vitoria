import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders() {
    const [orders] = useState([])
    const [loading, setLoading] = useState(false)

    async function createOrder(orderData) {
        setLoading(true)
        try {
            let clienteId = orderData.cliente_id

            // 1. If we have a customer code (from URL), prioritize lookup by code
            if (!clienteId && orderData.codigo_cliente) {
                const { data: existingByCode } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('codigo', orderData.codigo_cliente)
                    .maybeSingle()

                if (existingByCode) {
                    clienteId = existingByCode.id
                }
            }

            // 2. Fallback: If no ID yet, try to find an existing client by phone number
            if (!clienteId && orderData.telefone_cliente) {
                const { data: existingByPhone } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('telefone', orderData.telefone_cliente)
                    .maybeSingle()

                if (existingByPhone) {
                    clienteId = existingByPhone.id
                } else {
                    // 3. Create new client! If a code was provided (from URL), attach it!
                    const { data: newClient, error: clientErr } = await supabase
                        .from('clientes')
                        .insert({
                            nome: orderData.nome_cliente,
                            telefone: orderData.telefone_cliente,
                            codigo: orderData.codigo_cliente || null
                        })
                        .select()
                        .single()
                    if (clientErr) throw clientErr
                    clienteId = newClient.id
                }
            }

            /* 2. Check for existing active order on this table (by mesa_id first, then comanda_id) */
            let pedido = null
            let isExistingComanda = false

            // For mesa orders: look up by mesa_id so ALL devices at the same table share one order
            if (orderData.mesa_id) {
                const { data: existingByMesa } = await supabase
                    .from('pedidos')
                    .select('*')
                    .eq('mesa_id', orderData.mesa_id)
                    .eq('pago', false)
                    .order('criado_em', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (existingByMesa) {
                    pedido = existingByMesa
                    isExistingComanda = true
                    // Adopt the existing comanda_id so this device syncs
                    orderData.comanda_id = existingByMesa.comanda_id
                }
            }

            // Fallback: if not found by mesa_id, try by comanda_id (e.g. same device adding more items)
            if (!pedido && orderData.comanda_id) {
                const { data: existingByComanda } = await supabase
                    .from('pedidos')
                    .select('*')
                    .eq('comanda_id', orderData.comanda_id)
                    .eq('pago', false)
                    .order('criado_em', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (existingByComanda) {
                    pedido = existingByComanda
                    isExistingComanda = true
                }
            }

            if (isExistingComanda && pedido) {
                /* Update existing order */
                const { data: updatedPedido, error: updateErr } = await supabase
                    .from('pedidos')
                    .update({
                        subtotal: pedido.subtotal + orderData.subtotal,
                        valor_total: pedido.valor_total + orderData.valor_total,
                        valor_upsell: (pedido.valor_upsell || 0) + (orderData.valor_upsell || 0),
                        observacoes: orderData.observacoes
                            ? `${pedido.observacoes || ''}\n[ADICIONAL]: ${orderData.observacoes}`.trim()
                            : pedido.observacoes,
                        status: 'confirmado', // Move back to "Received" column
                        comanda_status: 'aberta' // Reset to open in case it was requesting closing
                    })
                    .eq('id', pedido.id)
                    .select()
                    .single()

                if (updateErr) throw updateErr
                pedido = updatedPedido
            } else {
                /* Create new order */
                const { data: newPedido, error: pedidoErr } = await supabase
                    .from('pedidos')
                    .insert({
                        cliente_id: clienteId,
                        nome_cliente: orderData.nome_cliente,
                        telefone_cliente: orderData.telefone_cliente,
                        tipo_pedido: orderData.tipo_pedido,
                        subtotal: orderData.subtotal,
                        taxa_entrega: orderData.taxa_entrega || 0,
                        valor_total: orderData.valor_total,
                        valor_upsell: orderData.valor_upsell || 0,
                        forma_pagamento: orderData.forma_pagamento,
                        troco_para: orderData.troco_para,
                        endereco: orderData.endereco,
                        observacoes: orderData.observacoes,
                        mesa_id: orderData.mesa_id || null,
                        comanda_id: orderData.comanda_id || null,
                        pago: orderData.pago || false,
                        comanda_status: orderData.comanda_status || (orderData.comanda_id ? 'aberta' : null),
                        status: 'confirmado',
                    })
                    .select()
                    .single()

                if (pedidoErr) throw pedidoErr
                pedido = newPedido
            }

            /* 3. Create order items */
            const itens = orderData.itens.map(item => ({
                pedido_id: pedido.id,
                produto_id: item.produto_id,
                variacao_id: item.variacao_id || null,
                quantidade: item.quantidade,
                preco_unitario: item.preco,
                eh_upsell: item.eh_upsell || false,
                observacoes: item.observacoes || null,
                personalizacao: item.personalizacao || null
            }))

            const { error: itensErr } = await supabase
                .from('itens_pedido')
                .insert(itens)

            if (itensErr) throw itensErr

            /* 4. Stock is handled automatically by DB trigger fn_trg_baixa_estoque_pedido */

            return pedido
        } catch (err) {
            console.error('Erro ao criar pedido:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }

    async function requestComandaClosing(comandaId) {
        if (!comandaId) return
        setLoading(true)
        try {
            const { error } = await supabase
                .from('pedidos')
                .update({ comanda_status: 'fechamento_solicitado' })
                .eq('comanda_id', comandaId)
            if (error) throw error
        } catch (err) {
            console.error('Erro ao solicitar fechamento:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }

    async function finalizeComanda(comandaId) {
        if (!comandaId) return
        setLoading(true)
        try {
            const { error } = await supabase
                .from('pedidos')
                .update({
                    comanda_status: 'paga',
                    pago: true,
                    status: 'entregue' // Immediately mark as delivered/completed
                })
                .eq('comanda_id', comandaId)
            if (error) throw error
        } catch (err) {
            console.error('Erro ao finalizar comanda:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }

    return { orders, loading, createOrder, requestComandaClosing, finalizeComanda }
}

export async function getActiveComanda(mesaId) {
    if (!mesaId) return null
    try {
        // First try to find an order with a comanda_id
        const { data, error } = await supabase
            .from('pedidos')
            .select('comanda_id')
            .eq('mesa_id', mesaId)
            .eq('pago', false)
            .not('comanda_id', 'is', null)
            .order('criado_em', { ascending: false })
            .limit(1)

        if (error) throw error

        // Return the first comanda_id found (safe even with multiple rows)
        if (data && data.length > 0) {
            return data[0].comanda_id
        }
        return null
    } catch (err) {
        console.error('Erro ao buscar comanda ativa:', err)
        return null
    }
}

export function useOrderTracking(orderId) {
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!orderId) return

        let isMounted = true

        /* Fetch full order data */
        async function fetchOrder() {
            const { data, error } = await supabase
                .from('pedidos')
                .select('*, itens_pedido(*, produtos(nome, imagem_url), variacoes_produto(nome)), entregadores(nome, telefone)')
                .eq('id', orderId)
                .single()

            if (!error && isMounted) setOrder(data)
            if (isMounted) setLoading(false)
        }

        fetchOrder()

        /* Realtime subscription */
        const channel = supabase
            .channel(`pedido-tracking-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'pedidos',
                    filter: `id=eq.${orderId}`,
                },
                (payload) => {
                    console.log('[useOrderTracking] Pedido atualizado:', payload.new)
                    if (payload.new && isMounted) {
                        setOrder(prev => prev ? { ...prev, ...payload.new } : prev)
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[useOrderTracking] Status inscricao (${orderId}):`, status)
            })

        /* Visibility change: re-fetch when user returns to the tab/app */
        function handleVisibilityChange() {
            if (document.visibilityState === 'visible' && isMounted) {
                console.log('[useOrderTracking] Tab visible again, re-fetching...')
                fetchOrder()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        /* Polling fallback: every 15s as safety net for dropped WebSocket */
        const pollInterval = setInterval(() => {
            if (document.visibilityState === 'visible' && isMounted) {
                fetchOrder()
            }
        }, 15000)

        return () => {
            isMounted = false
            supabase.removeChannel(channel)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            clearInterval(pollInterval)
        }
    }, [orderId])

    return { order, loading }
}

export function useCustomerOrders(clienteId) {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clienteId) {
            setLoading(false)
            return
        }

        async function fetchOrders() {
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('pedidos')
                    .select('*')
                    .eq('cliente_id', clienteId)
                    .order('criado_em', { ascending: false })

                if (!error) setOrders(data)
            } catch (err) {
                console.error('Erro ao buscar pedidos do cliente:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchOrders()

        // Realtime subscription for updates (e.g., status changes)
        const channel = supabase
            .channel(`cliente-pedidos-${clienteId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'pedidos',
                    filter: `cliente_id=eq.${clienteId}`,
                },
                (payload) => {
                    console.log('[useCustomerOrders] Pedidos do cliente atualizados:', payload)
                    fetchOrders()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [clienteId])

    return { orders, loading }
}


export function useComanda(comandaId) {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchOrders = useCallback(async () => {
        if (!comandaId) {
            setLoading(false)
            return
        }
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select('*, itens_pedido(*, produtos(nome, imagem_url), variacoes_produto(nome))')
                .eq('comanda_id', comandaId)
                .eq('pago', false) // Only show unpaid orders (current session)
                .order('criado_em', { ascending: true })

            if (error) throw error
            setOrders(data || [])
        } catch (err) {
            console.error('Erro ao buscar pedidos da comanda:', err)
        } finally {
            setLoading(false)
        }
    }, [comandaId])

    useEffect(() => {
        fetchOrders()

        const channel = supabase
            .channel(`comanda-${comandaId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'pedidos',
                    filter: `comanda_id=eq.${comandaId}`, // We filter in JS or filter precisely here
                },
                (payload) => {
                    // Refresh if the updated/inserted order is not paid
                    if (payload.new && payload.new.pago === true) {
                        fetchOrders() // This will clear the items because of the .eq('pago', false) filter
                    } else {
                        fetchOrders()
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [comandaId, fetchOrders])

    const total = orders.reduce((acc, order) => acc + (order.pago ? 0 : order.valor_total), 0)
    const status = orders[0]?.comanda_status || 'aberta'

    return { orders, total, status, loading, refresh: fetchOrders }
}
