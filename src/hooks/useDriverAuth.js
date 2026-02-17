import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDriverAuth() {
    const [driver, setDriver] = useState(null)
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)

    useEffect(() => {
        // Initialize from session
        const initSession = async () => {
            try {
                const { data, error } = await supabase.auth.getSession()
                if (data?.session?.user) {
                    await fetchDriverProfile(data.session.user.id)
                }
            } catch (err) {
                console.error('[useDriverAuth] Erro ao buscar sessão:', err)
            } finally {
                setInitializing(false)
            }
        }

        initSession()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                await fetchDriverProfile(session.user.id)
            } else {
                setDriver(null)
            }
            setInitializing(false)
        })

        return () => subscription.unsubscribe()
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
