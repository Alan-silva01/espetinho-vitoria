import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Simple memory cache
let globalProductsCache = null
let globalCategoriesCache = null
let globalProductDetailsCache = {}

export function useProducts() {
    const [products, setProducts] = useState(globalProductsCache || [])
    const [categories, setCategories] = useState(globalCategoriesCache || [])
    const [loading, setLoading] = useState(!globalProductsCache)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!globalProductsCache) {
            fetchAll()
        }
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
                    .order('ordem_exibicao')
                    .order('ordem_exibicao', { foreignTable: 'variacoes_produto', ascending: true }),
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
            globalCategoriesCache = catRes.data || []
            globalProductsCache = prodRes.data || []
            setCategories(globalCategoriesCache)
            setProducts(globalProductsCache)
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
                    setProducts(current => {
                        const next = [...current, payload.new]
                        globalProductsCache = next
                        return next
                    })
                } else if (payload.eventType === 'UPDATE') {
                    setProducts(current => {
                        const next = current.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
                        globalProductsCache = next
                        // Also clear detailed cache for this product
                        delete globalProductDetailsCache[payload.new.id]
                        return next
                    })
                } else if (payload.eventType === 'DELETE') {
                    setProducts(current => {
                        const next = current.filter(p => p.id !== payload.old.id)
                        globalProductsCache = next
                        delete globalProductDetailsCache[payload.old.id]
                        return next
                    })
                }
            })
            // Categories
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, (payload) => {
                console.log('[useProducts] Mudança em categorias:', payload)
                if (payload.eventType === 'INSERT') {
                    setCategories(current => {
                        const next = [...current, payload.new].sort((a, b) => a.ordem_exibicao - b.ordem_exibicao)
                        globalCategoriesCache = next
                        return next
                    })
                } else if (payload.eventType === 'UPDATE') {
                    setCategories(current => {
                        const next = current.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c).sort((a, b) => a.ordem_exibicao - b.ordem_exibicao)
                        globalCategoriesCache = next
                        return next
                    })
                } else if (payload.eventType === 'DELETE') {
                    setCategories(current => {
                        const next = current.filter(c => c.id !== payload.old.id)
                        globalCategoriesCache = next
                        return next
                    })
                }
            })
            // Variations
            .on('postgres_changes', { event: '*', schema: 'public', table: 'variacoes_produto' }, (payload) => {
                console.log('[useProducts] Mudança em variacoes:', payload)
                setProducts(current => Object.assign([], current.map(p => {
                    if (p.id === payload.new?.produto_id || p.id === payload.old?.produto_id) {
                        delete globalProductDetailsCache[p.id]
                        let newVariations = [...(p.variacoes_produto || [])]
                        if (payload.eventType === 'INSERT') {
                            newVariations.push(payload.new)
                        } else if (payload.eventType === 'UPDATE') {
                            newVariations = newVariations.map(v => v.id === payload.new.id ? payload.new : v)
                        } else if (payload.eventType === 'DELETE') {
                            newVariations = newVariations.filter(v => v.id !== payload.old.id)
                        }
                        return { ...p, variacoes_produto: newVariations }
                    }
                    return p
                })))
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
    const [product, setProduct] = useState(globalProductDetailsCache[id] || null)
    const [loading, setLoading] = useState(!globalProductDetailsCache[id])

    useEffect(() => {
        if (!id) return

        async function fetch() {
            setLoading(true)
            try {
                if (globalProductDetailsCache[id]) {
                    // Already in cache, skip fetch
                    setProduct(globalProductDetailsCache[id])
                    setLoading(false)
                    return
                }

                const { data, error } = await supabase
                    .from('produtos')
                    .select('*, categorias(nome, icone), variacoes_produto(*)')
                    .eq('id', id)
                    .order('ordem_exibicao', { foreignTable: 'variacoes_produto', ascending: true })
                    .single()

                if (error) throw error
                globalProductDetailsCache[id] = data
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
                    setProduct(current => {
                        const next = { ...current, ...payload.new }
                        globalProductDetailsCache[id] = next
                        return next
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [id])

    return { product, loading }
}
