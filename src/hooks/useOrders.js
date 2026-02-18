import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders() {
    const [orders, setOrders] = useState([])
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
                } else if (!orderData.codigo_cliente) {
                    // 3. Create new client ONLY if not found by phone AND no code was provided
                    // If a code was provided but not found, we should probably still create one or error,
                    // but usually the code should exist. For safety, if code provided but not found, 
                    // we create a new one as well but without a preset code.
                    const { data: newClient, error: clientErr } = await supabase
                        .from('clientes')
                        .insert({
                            nome: orderData.nome_cliente,
                            telefone: orderData.telefone_cliente,
                        })
                        .select()
                        .single()
                    if (clientErr) throw clientErr
                    clienteId = newClient.id
                }
            }

            /* 2. Create order */
            const { data: pedido, error: pedidoErr } = await supabase
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
                    status: 'confirmado',
                })
                .select()
                .single()

            if (pedidoErr) throw pedidoErr

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

            /* 4. Update stock levels (Automatic Reduction) */
            for (const item of orderData.itens) {
                // Fetch current stock and control flag
                const { data: prod } = await supabase
                    .from('produtos')
                    .select('quantidade_disponivel, controlar_estoque')
                    .eq('id', item.produto_id)
                    .single()

                if (prod && prod.controlar_estoque) {
                    const newQty = Math.max(0, prod.quantidade_disponivel - item.quantidade)
                    const updateFields = { quantidade_disponivel: newQty }
                    // Marcar como indisponível automaticamente quando estoque zerar
                    if (newQty === 0) {
                        updateFields.disponivel = false
                    }
                    await supabase
                        .from('produtos')
                        .update(updateFields)
                        .eq('id', item.produto_id)

                    // Also update daily stock if exists
                    const today = new Date().toISOString().split('T')[0]
                    const { data: stockToday } = await supabase
                        .from('estoque_diario')
                        .select('id, quantidade_atual')
                        .eq('produto_id', item.produto_id)
                        .eq('data', today)
                        .single()

                    if (stockToday) {
                        await supabase
                            .from('estoque_diario')
                            .update({ quantidade_atual: Math.max(0, stockToday.quantidade_atual - item.quantidade) })
                            .eq('id', stockToday.id)
                    }
                }
            }

            return pedido
        } catch (err) {
            console.error('Erro ao criar pedido:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }

    return { orders, loading, createOrder }
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

