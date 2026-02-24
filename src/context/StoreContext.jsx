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

        // Real-time synchronization with auto-reconnect
        console.log('[StoreContext] Setting up Realtime channel...')
        let retryTimeout = null
        let retryCount = 0

        const setupChannel = () => {
            const channel = supabase
                .channel('global-store-status-' + Date.now())
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
                        retryCount = 0
                    }
                    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        console.warn('[StoreContext] Problema na conexão Realtime — tentando reconectar...')
                        supabase.removeChannel(channel)
                        const delay = Math.min(5000 * Math.pow(2, retryCount), 30000)
                        retryCount++
                        retryTimeout = setTimeout(setupChannel, delay)
                    }
                })

            return channel
        }

        let currentChannel = setupChannel()

        // Wake-from-sleep: re-fetch and let realtime reconnect naturally
        let hiddenAt = null
        function handleVisibilityChange() {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now()
            }
            if (document.visibilityState === 'visible') {
                const elapsed = hiddenAt ? Date.now() - hiddenAt : 0
                if (elapsed >= 10_000) {
                    console.log('[StoreContext] Page woke after', Math.round(elapsed / 1000), 's — refreshing')
                    fetchStoreStatus()
                }
                hiddenAt = null
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            console.log('[StoreContext] Cleaning up Realtime channel')
            if (retryTimeout) clearTimeout(retryTimeout)
            supabase.removeChannel(currentChannel)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
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
        const now = new Date()
        const brTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
        const brTime = new Date(brTimeStr)

        if (isNaN(brTime.getTime())) return null // Fallback se falhar a data
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
                    if (horario_abertura && horario_fechamento && currentTime >= horario_abertura && currentTime <= horario_fechamento) {
                        return null
                    }
                    if (horario_abertura && currentTime < horario_abertura) {
                        return {
                            type: 'future_opening',
                            message: `Abrimos hoje às ${horario_abertura.slice(0, 5)}`,
                            openTime: horario_abertura.slice(0, 5)
                        }
                    }
                } else if (i === 1) {
                    if (horario_abertura) {
                        return {
                            type: 'future_opening',
                            message: `Abrimos amanhã às ${horario_abertura.slice(0, 5)}`,
                            openTime: horario_abertura.slice(0, 5)
                        }
                    }
                } else {
                    const diaNome = diasNomes[checkDayIndex]
                    if (horario_abertura) {
                        return {
                            type: 'future_opening',
                            message: `Abrimos ${diaNome} às ${horario_abertura.slice(0, 5)}`,
                            openTime: horario_abertura.slice(0, 5)
                        }
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
