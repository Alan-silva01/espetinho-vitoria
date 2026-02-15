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

    // Realtime subscription for products
    useEffect(() => {
        const channel = supabase
            .channel('public:produtos')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'produtos' },
                (payload) => {
                    console.log('[useProducts] Atualização em tempo real:', payload.new)
                    setProducts(current => current.map(p =>
                        p.id === payload.new.id ? { ...p, ...payload.new } : p
                    ))
                }
            )
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
    }, [id])

    return { product, loading }
}
