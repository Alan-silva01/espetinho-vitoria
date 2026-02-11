import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useStore() {
    const [config, setConfig] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetch() {
            const { data, error } = await supabase
                .from('configuracoes_loja')
                .select('*')
                .limit(1)
                .single()

            if (!error) setConfig(data)
            setLoading(false)
        }
        fetch()
    }, [])

    const isOpen = config?.esta_aberta ?? true

    return { config, loading, isOpen }
}
