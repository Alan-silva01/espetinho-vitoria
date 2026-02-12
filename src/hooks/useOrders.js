import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(false)

    async function createOrder(orderData) {
        setLoading(true)
        try {
            /* 1. Resolve client identify */
            let clienteId = orderData.cliente_id

            // If no ID provided, try to find an existing client by phone number
            if (!clienteId && orderData.telefone_cliente) {
                const { data: existing } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('telefone', orderData.telefone_cliente)
                    .maybeSingle()

                if (existing) {
                    clienteId = existing.id
                } else {
                    // Create new client if not found
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
                    await supabase
                        .from('produtos')
                        .update({ quantidade_disponivel: newQty })
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

        /* Initial fetch */
        async function fetch() {
            const { data, error } = await supabase
                .from('pedidos')
                .select('*, itens_pedido(*, produtos(nome, imagem_url)), entregadores(nome, telefone)')
                .eq('id', orderId)
                .single()

            if (!error) setOrder(data)
            setLoading(false)
        }
        fetch()

        /* Realtime subscription */
        const channel = supabase
            .channel(`pedido-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'pedidos',
                    filter: `id=eq.${orderId}`,
                },
                (payload) => {
                    setOrder(prev => prev ? { ...prev, ...payload.new } : payload.new)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [orderId])

    return { order, loading }
}
