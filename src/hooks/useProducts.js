import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useProducts() {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchAll()
    }, [])

    async function fetchAll() {
        console.log('[useProducts] Iniciando busca de produtos e categorias...')
        setLoading(true)
        try {
            const [catRes, prodRes] = await Promise.all([
                supabase
                    .from('categorias')
                    .select('*')
                    .eq('ativo', true)
                    .order('ordem_exibicao'),
                supabase
                    .from('produtos')
                    .select('*, categorias(nome, icone), variacoes_produto(*)')
                    .eq('disponivel', true)
                    .order('ordem_exibicao'),
            ])

            if (catRes.error) {
                console.error('[useProducts] Erro categorias:', catRes.error)
                throw catRes.error
            }
            if (prodRes.error) {
                console.error('[useProducts] Erro produtos:', prodRes.error)
                throw prodRes.error
            }

            console.log(`[useProducts] Sucesso: ${catRes.data?.length} categorias, ${prodRes.data?.length} produtos`)
            setCategories(catRes.data || [])
            setProducts(prodRes.data || [])
        } catch (err) {
            console.error('[useProducts] Falha ao carregar dados:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Realtime subscription for menu data (Products, Categories, Variations)
    useEffect(() => {
        const channel = supabase
            .channel('menu-updates')
            // Products
            .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, (payload) => {
                console.log('[useProducts] Mudança em produtos:', payload)
                if (payload.eventType === 'INSERT') {
                    setProducts(current => [...current, payload.new])
                } else if (payload.eventType === 'UPDATE') {
                    setProducts(current => current.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
                } else if (payload.eventType === 'DELETE') {
                    setProducts(current => current.filter(p => p.id === payload.old.id))
                }
            })
            // Categories
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, (payload) => {
                console.log('[useProducts] Mudança em categorias:', payload)
                if (payload.eventType === 'INSERT') {
                    setCategories(current => [...current, payload.new].sort((a, b) => a.ordem_exibicao - b.ordem_exibicao))
                } else if (payload.eventType === 'UPDATE') {
                    setCategories(current => current.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c).sort((a, b) => a.ordem_exibicao - b.ordem_exibicao))
                } else if (payload.eventType === 'DELETE') {
                    setCategories(current => current.filter(c => c.id === payload.old.id))
                }
            })
            // Variations
            .on('postgres_changes', { event: '*', schema: 'public', table: 'variacoes_produto' }, (payload) => {
                console.log('[useProducts] Mudança em variacoes:', payload)
                setProducts(current => current.map(p => {
                    if (p.id === payload.new?.produto_id || p.id === payload.old?.produto_id) {
                        // For variations, it's easier to just trigger a re-fetch or find/update in the nested array
                        // But since variety is nested, let's keep it simple: any variety change -> re-fetch might be safer
                        // Or we can try to update the nested array:
                        let newVariations = [...(p.variacoes_produto || [])]
                        if (payload.eventType === 'INSERT') {
                            newVariations.push(payload.new)
                        } else if (payload.eventType === 'UPDATE') {
                            newVariations = newVariations.map(v => v.id === payload.new.id ? payload.new : v)
                        } else if (payload.eventType === 'DELETE') {
                            newVariations = newVariations.filter(v => v.id === payload.old.id)
                        }
                        return { ...p, variacoes_produto: newVariations }
                    }
                    return p
                }))
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    function getProductsByCategory(categoryId) {
        if (!categoryId) return products
        return products.filter(p => p.categoria_id === categoryId)
    }

    function getProduct(id) {
        return products.find(p => p.id === id)
    }

    function getUpsellProducts() {
        return products.filter(p => p.item_upsell && p.quantidade_disponivel > 0)
    }

    return {
        products, categories, loading, error,
        getProductsByCategory, getProduct, getUpsellProducts,
        refetch: fetchAll,
    }
}

export function useProduct(id) {
    const [product, setProduct] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!id) return

        async function fetch() {
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('produtos')
                    .select('*, categorias(nome, icone), variacoes_produto(*)')
                    .eq('id', id)
                    .single()

                if (error) throw error
                setProduct(data)
            } catch (err) {
                console.error('[useProduct] Erro ao carregar produto:', err.message)
            } finally {
                setLoading(false)
            }
        }

        fetch()

        // Realtime subscription for this specific product
        const channel = supabase
            .channel(`product:${id}`)
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'produtos',
                    filter: `id=eq.${id}`
                },
                (payload) => {
                    console.log('[useProduct] Produto atualizado via Realtime:', payload.new)
                    setProduct(current => ({ ...current, ...payload.new }))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [id])

    return { product, loading }
}
