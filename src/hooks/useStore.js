import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useStore() {
    const [config, setConfig] = useState(null)
    const [horarios, setHorarios] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchStoreStatus = async () => {
        try {
            const [configRes, horariosRes] = await Promise.all([
                supabase.from('configuracoes_loja').select('*').single(),
                supabase.from('horarios_funcionamento').select('*')
            ])
            if (configRes.data) setConfig(configRes.data)
            if (horariosRes.data) setHorarios(horariosRes.data)
        } catch (err) {
            console.error('[useStore] Erro:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStoreStatus()

        // Real-time synchronization
        const configSub = supabase
            .channel('store_status_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_loja' }, () => {
                fetchStoreStatus()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_funcionamento' }, () => {
                fetchStoreStatus()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(configSub)
        }
    }, [])

    const calculateIsOpen = () => {
        if (!config || !horarios.length) return true

        // 1. Manual switch
        if (config.esta_aberta === false) return false

        // 2. Exceptional closure
        if (config.fechar_hoje_excepcionalmente) return false

        // 3. Weekly schedule (Brasília Time)
        const now = new Date()
        const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const day = brTime.getDay()
        const currentTime = brTime.getHours().toString().padStart(2, '0') + ':' +
            brTime.getMinutes().toString().padStart(2, '0') + ':00'

        const todaySchedule = horarios.find(h => h.dia_semana === day)

        if (!todaySchedule || !todaySchedule.aberto) return false

        // 4. Time range
        const openTime = todaySchedule.horario_abertura
        const closeTime = todaySchedule.horario_fechamento

        return currentTime >= openTime && currentTime <= closeTime
    }

    const isOpen = calculateIsOpen()

    return { config, loading, isOpen }
}
