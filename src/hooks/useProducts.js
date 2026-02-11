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

            if (catRes.error) throw catRes.error
            if (prodRes.error) throw prodRes.error

            setCategories(catRes.data)
            setProducts(prodRes.data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    function getProductsByCategory(categoryId) {
        if (!categoryId) return products
        return products.filter(p => p.categoria_id === categoryId)
    }

    function getProduct(id) {
        return products.find(p => p.id === id)
    }

    function getUpsellProducts() {
        return products.filter(p => p.item_upsell)
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
            const { data, error } = await supabase
                .from('produtos')
                .select('*, categorias(nome, icone), variacoes_produto(*)')
                .eq('id', id)
                .single()

            if (!error) setProduct(data)
            setLoading(false)
        }
        fetch()
    }, [id])

    return { product, loading }
}
