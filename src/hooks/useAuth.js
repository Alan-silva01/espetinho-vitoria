import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
    const [user, setUser] = useState(null)
    const [adminInfo, setAdminInfo] = useState(null)
    const [loading, setLoading] = useState(true)
    const mounted = useRef(true)
    const initializedRef = useRef(false)

    async function resolveAdmin(authUser) {
        if (!mounted.current || !authUser) return

        setUser(authUser)

        // Fast-track for known test user
        if (authUser.email === 'teste@gmail.com') {
            if (mounted.current) {
                setAdminInfo({
                    id: authUser.id,
                    nome: 'Admin Teste',
                    email: 'teste@gmail.com',
                    cargo: 'dono',
                    permissoes: { all: true }
                })
                setLoading(false)
            }
            return
        }

        // Fetch admin info
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            if (mounted.current) {
                if (!error && data) {
                    setAdminInfo(data)
                } else {
                    console.warn('[useAuth] Not an admin:', error?.message)
                    setAdminInfo(null)
                }
                setLoading(false)
            }
        } catch (err) {
            console.error('[useAuth] Admin fetch error:', err)
            if (mounted.current) setLoading(false)
        }
    }

    useEffect(() => {
        mounted.current = true

        async function init() {
            try {
                // 1. Check for existing session first
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.user) {
                    // Already logged in — resolve immediately
                    await resolveAdmin(session.user)
                    initializedRef.current = true
                    return
                }

                // 2. No session — check bypass
                const bypass = localStorage.getItem('espetinho_admin_bypass')
                if (bypass === 'true') {
                    const email = localStorage.getItem('espetinho_admin_email') || 'teste@gmail.com'
                    const password = localStorage.getItem('espetinho_admin_password') || '123321'
                    try {
                        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
                        if (error) throw error
                        if (data?.user) {
                            await resolveAdmin(data.user)
                            initializedRef.current = true
                            return
                        }
                    } catch (err) {
                        console.error('[useAuth] Bypass login failed:', err.message)
                        localStorage.removeItem('espetinho_admin_bypass')
                    }
                }

                // 3. No session, no bypass — not authenticated
                if (mounted.current) {
                    setUser(null)
                    setAdminInfo(null)
                    setLoading(false)
                }
                initializedRef.current = true
            } catch (err) {
                console.error('[useAuth] Init error:', err)
                if (mounted.current) setLoading(false)
                initializedRef.current = true
            }
        }

        init()

        // Listen for future auth changes (logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Skip events during initial load to avoid race conditions
            if (!initializedRef.current) return
            if (!mounted.current) return

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) await resolveAdmin(session.user)
            } else if (event === 'SIGNED_OUT') {
                if (mounted.current) {
                    setUser(null)
                    setAdminInfo(null)
                    setLoading(false)
                }
            }
        })

        // Safety timeout
        const safety = setTimeout(() => {
            if (mounted.current && loading) {
                console.warn('[useAuth] ⚠️ Safety timeout — forcing load complete')
                setLoading(false)
            }
        }, 4000)

        return () => {
            mounted.current = false
            clearTimeout(safety)
            subscription.unsubscribe()
        }
    }, [])

    async function login(email, password) {
        setLoading(true)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            setLoading(false)
            throw error
        }
        // Resolve admin immediately, don't rely on listener
        if (data?.user) {
            await resolveAdmin(data.user)
        }
        return data
    }

    async function logout() {
        setLoading(true)
        localStorage.removeItem('espetinho_admin_bypass')
        await supabase.auth.signOut()
        if (mounted.current) {
            setUser(null)
            setAdminInfo(null)
            setLoading(false)
        }
    }

    return {
        user,
        adminInfo,
        loading,
        isAuthenticated: !!user && !!adminInfo,
        login,
        logout,
    }
}
