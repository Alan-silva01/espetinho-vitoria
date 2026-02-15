import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const StoreContext = createContext()

export function StoreProvider({ children }) {
    const [config, setConfig] = useState(null)
    const [horarios, setHorarios] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchStoreStatus = useCallback(async () => {
        try {
            const [configRes, horariosRes] = await Promise.all([
                supabase.from('configuracoes_loja').select('*').single(),
                supabase.from('horarios_funcionamento').select('*')
            ])
            if (configRes.data) setConfig(configRes.data)
            if (horariosRes.data) setHorarios(horariosRes.data)
        } catch (err) {
            console.error('[StoreContext] Erro ao buscar status:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStoreStatus()

        // Real-time synchronization
        console.log('[StoreContext] Setting up Realtime channel...')
        const channel = supabase
            .channel('global-store-status')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'configuracoes_loja' },
                (payload) => {
                    console.log('[StoreContext] Mudança detectada em configuracoes_loja:', payload.eventType)
                    fetchStoreStatus()
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'horarios_funcionamento' },
                () => {
                    console.log('[StoreContext] Mudança detectada em horarios_funcionamento')
                    fetchStoreStatus()
                }
            )
            .subscribe((status) => {
                console.log(`[StoreContext] Status da inscrição Realtime: ${status}`)
                if (status === 'SUBSCRIBED') {
                    console.log('[StoreContext] Conexão Realtime estabelecida com sucesso!')
                }
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.warn('[StoreContext] Problema na conexão Realtime, tentando re-fetch...')
                    fetchStoreStatus()
                }
            })

        // Heartbeat fallback (30s)
        const heartbeat = setInterval(fetchStoreStatus, 30000)

        return () => {
            console.log('[StoreContext] Cleaning up Realtime channel')
            supabase.removeChannel(channel)
            clearInterval(heartbeat)
        }
    }, [fetchStoreStatus])

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

        // 3. Time-based Logic (Brasília Time)
        const brTimeStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
        const brTime = new Date(brTimeStr)
        const currentDay = brTime.getDay()
        const currentTime = brTime.getHours().toString().padStart(2, '0') + ':' +
            brTime.getMinutes().toString().padStart(2, '0') + ':00'

        const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

        for (let i = 0; i < 7; i++) {
            const checkDayIndex = (currentDay + i) % 7
            const daySchedule = horarios.find(h => h.dia_semana === checkDayIndex)

            if (daySchedule && daySchedule.aberto) {
                const { horario_abertura, horario_fechamento } = daySchedule

                if (i === 0) {
                    if (currentTime >= horario_abertura && currentTime <= horario_fechamento) {
                        return null
                    }
                    if (currentTime < horario_abertura) {
                        return {
                            type: 'future_opening',
                            message: `Abrimos hoje às ${horario_abertura.slice(0, 5)}`,
                            openTime: horario_abertura.slice(0, 5)
                        }
                    }
                } else if (i === 1) {
                    return {
                        type: 'future_opening',
                        message: `Abrimos amanhã às ${horario_abertura.slice(0, 5)}`,
                        openTime: horario_abertura.slice(0, 5)
                    }
                } else {
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

    return (
        <StoreContext.Provider value={{ config, horarios, loading, isOpen, closureInfo, fetchStoreStatus }}>
            {children}
        </StoreContext.Provider>
    )
}

export const useStoreValue = () => useContext(StoreContext)
