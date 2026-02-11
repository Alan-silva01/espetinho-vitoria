import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useInventory() {
    const [inventory, setInventory] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchInventory()

        /* Realtime */
        const channel = supabase
            .channel('estoque-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'estoque_diario' },
                () => fetchInventory()
            )
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [])

    async function fetchInventory(date) {
        const targetDate = date || new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
            .from('estoque_diario')
            .select('*, produtos(nome, imagem_url, categoria_id, categorias(nome))')
            .eq('data', targetDate)
            .order('produto_id')

        if (!error) setInventory(data)
        setLoading(false)
    }

    async function updateStock(id, updates) {
        const { error } = await supabase
            .from('estoque_diario')
            .update({ ...updates, atualizado_em: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    }

    async function toggleSoldOut(id, esgotado) {
        await updateStock(id, { esgotado })
    }

    async function createDailyStock(items) {
        const today = new Date().toISOString().split('T')[0]
        const records = items.map(item => ({
            produto_id: item.produto_id,
            data: today,
            qtd_inicial: item.qtd_inicial,
            qtd_atual: item.qtd_inicial,
            esgotado: false,
        }))

        const { error } = await supabase
            .from('estoque_diario')
            .upsert(records, { onConflict: 'produto_id,data' })

        if (error) throw error
        await fetchInventory()
    }

    return { inventory, loading, fetchInventory, updateStock, toggleSoldOut, createDailyStock }
}
