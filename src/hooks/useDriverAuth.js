import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useDriverAuth() {
    const [driver, setDriver] = useState(null)
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const initializedRef = useRef(false)
    const driverRef = useRef(null) // Always-current driver for event handlers

    // Keep ref in sync
    driverRef.current = driver

    useEffect(() => {
        let cancelled = false

        const initSession = async () => {
            try {
                const { data } = await supabase.auth.getSession()
                if (!cancelled && data?.session?.user) {
                    const profile = await fetchDriverProfile(data.session.user.id)
                    if (!profile) {
                        // User is logged in but not a driver
                        setDriver(null)
                    }
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

            // Skip re-fetching if driver is already loaded — prevents freeze from
            // SDK's internal token refresh firing SIGNED_IN/TOKEN_REFRESHED
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && driverRef.current) {
                console.log('[useDriverAuth]', event, '— driver already loaded, skipping')
                return
            }

            if (session?.user) {
                await fetchDriverProfile(session.user.id)
            } else {
                setDriver(null)
            }
        })

        // Wake-from-sleep: refresh session silently
        let hiddenAt = null
        function handleVisibilityChange() {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now()
            }
            if (document.visibilityState === 'visible') {
                const elapsed = hiddenAt ? Date.now() - hiddenAt : 0
                if (elapsed >= 10_000) {
                    console.log('[useDriverAuth] Woke after', Math.round(elapsed / 1000), 's — refreshing session')
                    supabase.auth.refreshSession().catch(err => {
                        console.warn('[useDriverAuth] Session refresh failed:', err.message)
                    })
                }
                hiddenAt = null
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            cancelled = true
            subscription.unsubscribe()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
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
