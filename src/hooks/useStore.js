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

        // 3. Next Opening Logic (Brasília Time)
        const now = new Date()
        const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const currentDay = brTime.getDay()
        const currentTime = brTime.getHours().toString().padStart(2, '0') + ':' +
            brTime.getMinutes().toString().padStart(2, '0') + ':00'

        // Check availability for the next 7 days
        const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

        for (let i = 0; i < 7; i++) {
            const checkDayIndex = (currentDay + i) % 7
            const daySchedule = horarios.find(h => h.dia_semana === checkDayIndex)

            if (daySchedule && daySchedule.aberto) {
                const { horario_abertura, horario_fechamento } = daySchedule

                // Case A: Checked day is TODAY
                if (i === 0) {
                    // Check if open NOW
                    if (currentTime >= horario_abertura && currentTime <= horario_fechamento) {
                        return null // Store is OPEN
                    }
                    // If before opening time
                    if (currentTime < horario_abertura) {
                        return {
                            type: 'future_opening',
                            message: `Abrimos hoje às ${horario_abertura.slice(0, 5)}`,
                            openTime: horario_abertura.slice(0, 5)
                        }
                    }
                    // If after closing time, continue loop to find next day
                }
                // Case B: Tomorrow
                else if (i === 1) {
                    return {
                        type: 'future_opening',
                        message: `Abrimos amanhã às ${horario_abertura.slice(0, 5)}`,
                        openTime: horario_abertura.slice(0, 5)
                    }
                }
                // Case C: Future Day
                else {
                    const diaNome = diasNomes[checkDayIndex]
                    return {
                        type: 'future_opening',
                        message: `Abrimos ${diaNome} às ${horario_abertura.slice(0, 5)}`,
                        openTime: horario_abertura.slice(0, 5)
                    }
                }
            }
        }

        return { type: 'closed_indefinitely', message: 'Fechado temporariamente. Verifique nossos horários.' }
    }

    const closureInfo = getClosureInfo()
    const isOpen = closureInfo === null

    return { config, horarios, loading, isOpen, closureInfo }
}
