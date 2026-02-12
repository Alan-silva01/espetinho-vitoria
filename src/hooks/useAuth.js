import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
    const [user, setUser] = useState(null)
    const [adminInfo, setAdminInfo] = useState(null)
    const [loading, setLoading] = useState(true)
    const mounted = useRef(true)

    useEffect(() => {
        let subscription = null

        async function bootstrap() {
            // 0. CHECK BYPASS (MAGIC KEY) — actually sign in with stored creds
            const bypass = localStorage.getItem('espetinho_admin_bypass')
            if (bypass === 'true') {
                console.log('[useAuth] ☢️ BYPASS ATIVADO: Tentando login real com credenciais salvas')
                const email = localStorage.getItem('espetinho_admin_email') || 'teste@gmail.com'
                const password = localStorage.getItem('espetinho_admin_password') || '123321'
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
                    if (error) throw error
                    if (data?.user) {
                        await handleUserSession(data.user)
                    }
                    return // bypass handled, skip normal init
                } catch (err) {
                    console.error('[useAuth] Bypass login failed:', err.message)
                    localStorage.removeItem('espetinho_admin_bypass')
                    if (mounted.current) setLoading(false)
                    return
                }
            }

            // 1. Normal auth init
            try {
                if (mounted.current) setLoading(true)
                const { data: { session }, error } = await supabase.auth.getSession()
                if (error) throw error

                if (session?.user) {
                    await handleUserSession(session.user)
                } else {
                    if (mounted.current) {
                        setUser(null)
                        setAdminInfo(null)
                        setLoading(false)
                    }
                }
            } catch (err) {
                console.error('[useAuth] Initialization error:', err)
                if (mounted.current) setLoading(false)
            }
        }

        bootstrap()

        // 2. Subscribe to changes
        const { data: subData } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[useAuth] Auth Event:', event)
            if (!mounted.current) return

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) await handleUserSession(session.user)
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                setAdminInfo(null)
                setLoading(false)
            }
        })
        subscription = subData.subscription

        // 3. SAFETY TIMEOUT (FAIL-SAFE)
        const safetyTimeout = setTimeout(() => {
            if (mounted.current) {
                console.warn('[useAuth] ⚠️ SAFETY TIMEOUT: Forcing loading completion.')
                setLoading(false)
            }
        }, 3000)

        return () => {
            mounted.current = false
            if (safetyTimeout) clearTimeout(safetyTimeout)
            if (subscription) subscription.unsubscribe()
        }
    }, [])

    async function handleUserSession(currentUser) {
        if (!mounted.current) return

        try {
            if (mounted.current) setUser(currentUser)

            // EMERGENCY BYPASS FOR TEST USER (Backstop)
            if (currentUser.email === 'teste@gmail.com') {
                console.warn('[useAuth] BYPASS: Forçando admin para teste@gmail.com')
                if (mounted.current) {
                    setAdminInfo({
                        id: currentUser.id,
                        nome: 'Admin Teste',
                        email: 'teste@gmail.com',
                        cargo: 'dono',
                        permissoes: { all: true }
                    })
                    setLoading(false)
                }
                return
            }

            // Fetch admin info with timeout
            const fetchPromise = supabase
                .from('admin_users')
                .select('*')
                .eq('id', currentUser.id)
                .single()

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout seeking admin info')), 5000)
            )

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

            if (mounted.current) {
                if (error) {
                    console.warn('[useAuth] Not an admin or fetch error:', error.message)
                    setAdminInfo(null)
                } else {
                    console.log('[useAuth] Admin info loaded')
                    setAdminInfo(data)
                }
            }
        } catch (err) {
            console.error('[useAuth] User processing error:', err)
        } finally {
            if (mounted.current) setLoading(false)
        }
    }

    async function login(email, password) {
        setLoading(true)
        const { data, error } = await supabase.auth.signInWithPassword({
            email, password,
        })
        if (error) {
            setLoading(false)
            throw error
        }
        return data
    }

    async function logout() {
        setLoading(true)
        // Clear bypass flag on logout
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
