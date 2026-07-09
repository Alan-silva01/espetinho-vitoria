import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrderNotificationSound(isAuthenticated) {
    const audioRef = useRef(new Audio('/notification.mp3'))
    const audioUnlockedRef = useRef(false)

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

    useEffect(() => {
        // Se não estiver autenticado como admin, não assina o canal
        if (!isAuthenticated) return

        let pendingTimeout = null;

        const channel = supabase
            .channel('global_admin_notifications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
                let shouldPlaySound = false

                if (payload.eventType === 'INSERT') {
                    // Novo pedido inserido (exclui mesas vazias, mas a criação inicial já soa)
                    shouldPlaySound = true
                } 
                else if (payload.eventType === 'UPDATE') {
                    // Verifica eventos de comanda (item adicionado ou fechamento)
                    // Como não temos o "oldOrder" completo aqui, verificamos as alterações nos campos chaves
                    
                    const oldRecord = payload.old
                    const newRecord = payload.new

                    const isNewItemAdded = oldRecord && newRecord.valor_total > (oldRecord.valor_total || 0)
                    const isClosingRequested = oldRecord && newRecord.comanda_status === 'fechamento_solicitado' && oldRecord.comanda_status !== 'fechamento_solicitado'

                    if (isNewItemAdded || isClosingRequested) {
                        shouldPlaySound = true
                    }
                }

                if (shouldPlaySound) {
                    // O debounce previne que o som toque múltiplas vezes muito rápido 
                    // (ex: inserção de VÁRIOS itens na comanda e atualização do total em cascata)
                    if (pendingTimeout) clearTimeout(pendingTimeout)
                    
                    pendingTimeout = setTimeout(() => {
                        console.log('[Global Notification] Tocando som de novo pedido / evento na comanda')
                        playNotificationSound()
                    }, 500) // Delay pequeno para consolidar eventos rápidos
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
