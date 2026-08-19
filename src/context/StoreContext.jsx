import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const StoreContext = createContext()

let globalConfigCache = null
let globalHorariosCache = null

export function StoreProvider({ children }) {
    const [config, setConfig] = useState(globalConfigCache)
    const [horarios, setHorarios] = useState(globalHorariosCache || [])
    const [loading, setLoading] = useState(true)

    const fetchStoreStatus = useCallback(async () => {
        try {
            if (!globalConfigCache) setLoading(true)

            const [configRes, horariosRes] = await Promise.all([
                supabase.from('configuracoes_loja').select('*').single(),
                supabase.from('horarios_funcionamento').select('*')
            ])
            if (configRes.data) {
                globalConfigCache = configRes.data
                setConfig(configRes.data)
            }
            if (horariosRes.data) {
                globalHorariosCache = horariosRes.data
                setHorarios(horariosRes.data)
            }
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
                .channel('store-config-sync')
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
        let wakeTimer = null
        function handleVisibilityChange() {
            if (document.visibilityState === 'hidden') {
                // Cancel any pending wake fetch if user left again
                if (wakeTimer) { clearTimeout(wakeTimer); wakeTimer = null }
                hiddenAt = Date.now()
            }
            if (document.visibilityState === 'visible') {
                if (hiddenAt && (Date.now() - hiddenAt) >= 300_000) {
                    // Staggered delay (3s) to avoid request spike with other contexts
                    wakeTimer = setTimeout(() => {
                        wakeTimer = null
                        // Re-check: still visible?
                        if (document.visibilityState === 'visible') {
                            console.log('[StoreContext] Page woke after', Math.round((Date.now() - (hiddenAt || Date.now())) / 1000), 's — refreshing')
                            fetchStoreStatus()
                        }
                    }, 3000)
                }
                hiddenAt = null
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            console.log('[StoreContext] Cleaning up Realtime channel')
            if (retryTimeout) clearTimeout(retryTimeout)
            if (wakeTimer) clearTimeout(wakeTimer)
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

        // 3. Time-based Logic (Brasília Time via Intl API — cross-device safe)
        const now = new Date()
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false
        }).formatToParts(now)
        const get = (type) => parts.find(p => p.type === type)?.value || '00'
        const brDate = new Date(parseInt(get('year')), parseInt(get('month')) - 1, parseInt(get('day')))
        if (isNaN(brDate.getTime())) return null
        const currentDay = brDate.getDay()
        const currentTime = get('hour').padStart(2, '0') + ':' + get('minute').padStart(2, '0') + ':00'

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

    const [closureInfo, setClosureInfo] = useState(() => getClosureInfo())
    const isOpen = closureInfo === null

    // Recalculate open/closed every 60s and on tab focus (fixes stale status bug)
    useEffect(() => {
        setClosureInfo(getClosureInfo())

        const interval = setInterval(() => {
            setClosureInfo(getClosureInfo())
        }, 60_000)

        const handleVisible = () => {
            if (document.visibilityState === 'visible') {
                setClosureInfo(getClosureInfo())
            }
        }
        document.addEventListener('visibilitychange', handleVisible)

        return () => {
            clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisible)
        }
    }, [config, horarios])

    const value = useMemo(() => ({
        config, horarios, loading, isOpen, closureInfo, fetchStoreStatus
    }), [config, horarios, loading, isOpen, closureInfo, fetchStoreStatus])

    return (
        <StoreContext.Provider value={value}>
            {children}
        </StoreContext.Provider>
    )
}

export const useStoreValue = () => useContext(StoreContext)
