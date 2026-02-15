import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/* Generate or retrieve a unique session ID for likes */
function getSessionId() {
    let sid = localStorage.getItem('espetinho_session')
    if (!sid) {
        sid = crypto.randomUUID()
        localStorage.setItem('espetinho_session', sid)
    }
    return sid
}

export function useFavorites() {
    const [liked, setLiked] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('espetinho_likes') || '{}')
        } catch {
            return {}
        }
    })
    const [animatingHearts, setAnimatingHearts] = useState({})

    const loadLikes = useCallback(async () => {
        const sessionId = getSessionId()
        const { data, error } = await supabase
            .from('curtidas')
            .select('produto_id')
            .eq('session_id', sessionId)

        if (!error && data) {
            const likesMap = {}
            data.forEach(row => {
                likesMap[row.produto_id] = true
            })
            setLiked(likesMap)
            localStorage.setItem('espetinho_likes', JSON.stringify(likesMap))
        }
    }, [])

    useEffect(() => {
        loadLikes()
    }, [loadLikes])

    const toggleLike = useCallback(async (productId) => {
        const sessionId = getSessionId()
        const isCurrentlyLiked = liked[productId]

        // Trigger heart burst animation state
        setAnimatingHearts(prev => ({ ...prev, [productId]: true }))
        setTimeout(() => setAnimatingHearts(prev => ({ ...prev, [productId]: false })), 800)

        if (isCurrentlyLiked) {
            // Optimistic remove
            setLiked(prev => {
                const next = { ...prev }
                delete next[productId]
                localStorage.setItem('espetinho_likes', JSON.stringify(next))
                return next
            })
            const { error } = await supabase
                .from('curtidas')
                .delete()
                .match({ produto_id: productId, session_id: sessionId })

            if (error) {
                console.error('Erro ao remover curtid:', error.message)
                // Rollback
                setLiked(prev => {
                    const next = { ...prev, [productId]: true }
                    localStorage.setItem('espetinho_likes', JSON.stringify(next))
                    return next
                })
            }
        } else {
            // Optimistic add
            setLiked(prev => {
                const next = { ...prev, [productId]: true }
                localStorage.setItem('espetinho_likes', JSON.stringify(next))
                return next
            })
            const { error } = await supabase
                .from('curtidas')
                .insert({ produto_id: productId, session_id: sessionId })

            if (error) {
                console.error('Erro ao curtir:', error.message)
                // Rollback
                setLiked(prev => {
                    const next = { ...prev }
                    delete next[productId]
                    localStorage.setItem('espetinho_likes', JSON.stringify(next))
                    return next
                })
            }
        }
    }, [liked])

    return {
        liked,
        toggleLike,
        animatingHearts,
        loadLikes
    }
}
