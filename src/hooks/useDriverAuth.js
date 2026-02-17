import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useDriverAuth() {
    const [driver, setDriver] = useState(null)
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const initializedRef = useRef(false)

    useEffect(() => {
        let cancelled = false

        const initSession = async () => {
            try {
                const { data } = await supabase.auth.getSession()
                if (!cancelled && data?.session?.user) {
                    await fetchDriverProfile(data.session.user.id)
                }
            } catch (err) {
                console.error('[useDriverAuth] Erro ao buscar sessão:', err)
            } finally {
                if (!cancelled) {
                    initializedRef.current = true
                    setInitializing(false)
                }
            }
        }

        initSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!initializedRef.current) return

            if (event === 'SIGNED_OUT') {
                setDriver(null)
                return
            }

            if (session?.user) {
                await fetchDriverProfile(session.user.id)
            } else {
                setDriver(null)
            }
        })

        return () => {
            cancelled = true
            subscription.unsubscribe()
        }
    }, [])

    async function fetchDriverProfile(authUserId) {
        try {
            const { data, error } = await supabase
                .from('entregadores')
                .select('*')
                .eq('auth_user_id', authUserId)
                .single()

            if (data && !error) {
                setDriver(data)
                return data
            }
        } catch (err) {
            console.error('Erro ao buscar perfil do entregador:', err)
        }
        return null
    }

    async function login(email, password) {
        setLoading(true)
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            const profile = await fetchDriverProfile(data.user.id)
            if (!profile) {
                await supabase.auth.signOut()
                throw new Error('Perfil de entregador não encontrado.')
            }

            return profile
        } finally {
            setLoading(false)
        }
    }

    async function logout() {
        await supabase.auth.signOut()
        setDriver(null)
    }

    return {
        driver,
        loading,
        initializing,
        isAuthenticated: !!driver,
        login,
        logout
    }
}
