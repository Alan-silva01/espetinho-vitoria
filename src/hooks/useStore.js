import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useStore() {
    const [config, setConfig] = useState(null)
    const [horarios, setHorarios] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStoreStatus() {
            try {
                console.log('[useStore] Buscando configurações de funcionamento...')
                const [configRes, horariosRes] = await Promise.all([
                    supabase
                        .from('configuracoes_loja')
                        .select('*')
                        .single(),
                    supabase
                        .from('horarios_funcionamento')
                        .select('*')
                ])

                if (configRes.error) console.error('[useStore] Erro config:', configRes.error)
                if (horariosRes.error) console.error('[useStore] Erro horários:', horariosRes.error)

                setConfig(configRes.data)
                setHorarios(horariosRes.data || [])
            } catch (err) {
                console.error('[useStore] Falha crítica:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchStoreStatus()
    }, [])

    const isOpen = (config?.esta_aberta && !config?.fechar_hoje_excepcionalmente) ?? true

    return { config, loading, isOpen }
}
