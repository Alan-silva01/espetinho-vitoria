import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(false)

    async function createOrder(orderData) {
        setLoading(true)
        try {
            /* 1. Create or find client */
            let clienteId = null
            const savedClient = localStorage.getItem('espetinho-client')
            if (savedClient) {
                const client = JSON.parse(savedClient)
                clienteId = client.id
            } else {
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
                localStorage.setItem('espetinho-client', JSON.stringify(newClient))
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
