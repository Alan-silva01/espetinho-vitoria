import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrderNotificationSound(isAuthenticated) {
    const audioRef = useRef(new Audio('/notification.mp3'))
    const audioUnlockedRef = useRef(false)
    const orderCacheRef = useRef({})

    // Helper para tocar o som lidando com o bloqueio do navegador
    const playNotificationSound = useCallback(() => {
        const audio = audioRef.current
        audio.currentTime = 0
        audio.play().catch(() => {
            // Browser blocked autoplay — register a one-time click listener to unlock
            if (!audioUnlockedRef.current) {
                const unlock = () => {
                    audioRef.current.play().catch(() => { })
                    audioUnlockedRef.current = true
                    document.removeEventListener('click', unlock)
                    document.removeEventListener('touchstart', unlock)
                }
                document.addEventListener('click', unlock, { once: true })
                document.addEventListener('touchstart', unlock, { once: true })
            }
        })
    }, [])

    // Inicializa o cache com os pedidos do dia corrente
    useEffect(() => {
        if (!isAuthenticated) return

        async function initCache() {
            try {
                const now = new Date()
                const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                const [y, m, d] = todayStr.split('-').map(Number)
                const spDate = new Date(y, m - 1, d, 0, 0, 0, 0)
                const midnightISO = spDate.toISOString()

                const endDate = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
                const endISO = endDate.toISOString()

                const { data, error } = await supabase
                    .from('pedidos')
                    .select('id, valor_total, comanda_status')
                    .gte('criado_em', midnightISO)
                    .lt('criado_em', endISO)

                if (!error && data) {
                    const cache = {}
                    data.forEach(o => {
                        cache[o.id] = {
                            valor_total: o.valor_total || 0,
                            comanda_status: o.comanda_status || 'aberta'
                        }
                    })
                    orderCacheRef.current = cache
                    console.log('[Notification Cache] Cache inicial carregado com', data.length, 'pedidos')
                }
            } catch (err) {
                console.error('[Notification Cache] Erro ao inicializar cache:', err)
            }
        }

        initCache()
    }, [isAuthenticated])

    useEffect(() => {
        // Se não estiver autenticado como admin, não assina o canal
        if (!isAuthenticated) return

        let pendingTimeout = null;

        const channel = supabase
            .channel('global_admin_notifications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
                let shouldPlaySound = false
                const newRecord = payload.new
                const orderId = newRecord?.id

                if (!orderId) return

                const cached = orderCacheRef.current[orderId]

                if (payload.eventType === 'INSERT') {
                    // Novo pedido inserido
                    shouldPlaySound = true
                } 
                else if (payload.eventType === 'UPDATE') {
                    // Se não estiver no cache (ex: pedido de outro dia ou que acabou de ser criado), 
                    // apenas inicializa a entrada e não toca o som de cara para evitar falsos alarmes
                    if (!cached) {
                        orderCacheRef.current[orderId] = {
                            valor_total: newRecord.valor_total || 0,
                            comanda_status: newRecord.comanda_status || 'aberta'
                        }
                        return
                    }

                    const isNewItemAdded = (newRecord.valor_total || 0) > (cached.valor_total || 0)
                    const isClosingRequested = newRecord.comanda_status === 'fechamento_solicitado' && cached.comanda_status !== 'fechamento_solicitado'

                    if (isNewItemAdded || isClosingRequested) {
                        shouldPlaySound = true
                    }
                }

                // Sempre atualiza o cache local após processar
                orderCacheRef.current[orderId] = {
                    valor_total: newRecord.valor_total || 0,
                    comanda_status: newRecord.comanda_status || 'aberta'
                }

                if (shouldPlaySound) {
                    // O debounce previne que o som toque múltiplas vezes muito rápido 
                    if (pendingTimeout) clearTimeout(pendingTimeout)
                    
                    pendingTimeout = setTimeout(() => {
                        console.log('[Global Notification] Tocando som de novo pedido / evento na comanda')
                        playNotificationSound()
                    }, 500)
                }
            })
            .subscribe((status) => {
                console.log('[Global Notification] Subscription status:', status)
            })

        return () => {
            if (pendingTimeout) clearTimeout(pendingTimeout)
            supabase.removeChannel(channel)
        }
    }, [isAuthenticated, playNotificationSound])

    return { playNotificationSound }
}
