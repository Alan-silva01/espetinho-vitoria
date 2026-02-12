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

    const getClosureInfo = () => {
        if (!config || !horarios.length) return null

        // 1. Manual switch
        if (config.esta_aberta === false) {
            return { type: 'manual', message: config.mensagem_fechamento }
        }

        // 2. Exceptional closure
        if (config.fechar_hoje_excepcionalmente) {
            return { type: 'exceptional', message: config.motivo_fechamento_hoje }
        }

        // 3. Weekly schedule (Brasília Time)
        const now = new Date()
        const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const day = brTime.getDay()
        const currentTime = brTime.getHours().toString().padStart(2, '0') + ':' +
            brTime.getMinutes().toString().padStart(2, '0') + ':00'

        if (day === 6) { // Saturday
            return { type: 'saturday', message: 'Sábados nós não abrimos, obrigado pela preferência, mas não abrimos no sábado.' }
        }

        const todaySchedule = horarios.find(h => h.dia_semana === day)

        if (!todaySchedule || !todaySchedule.aberto) {
            return { type: 'schedule_closed', message: 'Hoje não abrimos para atendimento.' }
        }

        // 4. Time range
        const openTime = todaySchedule.horario_abertura
        const closeTime = todaySchedule.horario_fechamento

        if (currentTime < openTime) {
            return { type: 'future_opening', openTime: openTime.slice(0, 5) }
        }

        if (currentTime > closeTime) {
            return { type: 'already_closed', message: 'Já encerramos o atendimento hoje.' }
        }

        return null // Store is open
    }

    const closureInfo = getClosureInfo()
    const isOpen = closureInfo === null

    return { config, horarios, loading, isOpen, closureInfo }
}
