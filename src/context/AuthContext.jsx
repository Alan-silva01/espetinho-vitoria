import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [state, setState] = useState(() => {
        const cached = localStorage.getItem('espetinho_admin_cache')
        if (cached) {
            try {
                const parsed = JSON.parse(cached)
                return {
                    user: parsed.user,
                    adminInfo: parsed.adminInfo,
                    loading: false
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
        return {
            user: null,
            adminInfo: null,
            loading: true
        }
    })
    const mounted = useRef(true)
    const initializedRef = useRef(false)
    const stateRef = useRef(state) // Always-current state for use in event handlers

    // Keep ref in sync with state
    stateRef.current = state

    async function resolveAdmin(authUser) {
        console.log('[AuthContext] Resolvendo admin para:', authUser?.email)
        if (!mounted.current || !authUser) {
            console.log('[AuthContext] Resolve abortado: não montado ou sem user')
            if (mounted.current) setState(prev => ({ ...prev, loading: false }))
            return
        }

        // Fast-track for known test user
        if (authUser.email === 'teste@gmail.com') {
            if (mounted.current) {
                const newAdminInfo = {
                    id: authUser.id,
                    nome: 'Admin Teste',
                    email: 'teste@gmail.com',
                    cargo: 'dono',
                    permissoes: { all: true }
                }

                localStorage.setItem('espetinho_admin_cache', JSON.stringify({
                    user: authUser,
                    adminInfo: newAdminInfo
                }))

                setState({
                    user: authUser,
                    adminInfo: newAdminInfo,
                    loading: false
                })
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
                console.log('[AuthContext] Admin resolvido com sucesso:', data?.nome)

                if (data) {
                    localStorage.setItem('espetinho_admin_cache', JSON.stringify({
                        user: authUser,
                        adminInfo: data
                    }))
                }

                setState({
                    user: authUser,
                    adminInfo: data || null,
                    loading: false
                })
                if (error || !data) {
                    console.warn('[AuthContext] Não é um admin:', error?.message)
                    localStorage.removeItem('espetinho_admin_cache')
                }
            }
        } catch (err) {
            console.error('[AuthContext] Erro ao resolver admin:', err)
            if (mounted.current) setState(prev => ({ ...prev, loading: false }))
        }
    }

    async function init() {
        console.log('[AuthContext] Inicializando...')
        try {
            // 1. Check for existing session
            const { data: { session } } = await supabase.auth.getSession()
            console.log('[AuthContext] Sessão inicial:', session ? 'Encontrada' : 'Nula')

            if (session?.user) {
                console.log('[AuthContext] Sessão existente encontrada, resolvendo admin...')
                await resolveAdmin(session.user)
                initializedRef.current = true
                return
            }

            // 2. No session — check bypass
            const bypass = localStorage.getItem('espetinho_admin_bypass')
            if (bypass === 'true') {
                console.log('[AuthContext] Bypass de login detectado, tentando login automático...')
                const email = localStorage.getItem('espetinho_admin_email') || 'teste@gmail.com'
                const password = localStorage.getItem('espetinho_admin_password') || '123321'
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
                    if (error) throw error
                    if (data?.user) {
                        console.log('[AuthContext] Login por bypass bem-sucedido.')
                        await resolveAdmin(data.user)
                        initializedRef.current = true
                        return
                    }
                } catch (err) {
                    console.error('[AuthContext] Falha no login por bypass:', err.message)
                    localStorage.removeItem('espetinho_admin_bypass')
                }
            }

            // 3. Not authenticated
            console.log('[AuthContext] Nenhum usuário autenticado ou bypass falhou.')
            localStorage.removeItem('espetinho_admin_cache')
            if (mounted.current) {
                setState({ user: null, adminInfo: null, loading: false })
            }
            initializedRef.current = true
        } catch (err) {
            console.error('[AuthContext] Erro na inicialização:', err)
            localStorage.removeItem('espetinho_admin_cache')
            if (mounted.current) setState({ user: null, adminInfo: null, loading: false })
            initializedRef.current = true
        }
    }

    useEffect(() => {
        mounted.current = true
        init()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!initializedRef.current || !mounted.current) return

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Skip if we already have this user resolved — prevents re-render cascade
                // that unmounts child pages and shows loading spinners
                if (session?.user?.id && stateRef.current.user?.id === session.user.id && stateRef.current.adminInfo) {
                    console.log('[AuthContext]', event, '— same user already resolved, skipping')
                    return
                }
                if (event === 'SIGNED_IN' && session?.user) {
                    await resolveAdmin(session.user)
                }
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('espetinho_admin_cache')
                if (mounted.current) {
                    setState({ user: null, adminInfo: null, loading: false })
                }
            }
        })

        // Wake-from-sleep: refresh Supabase session when the page becomes visible
        // This prevents stale auth tokens from breaking all API calls after OS sleep
        let hiddenAt = null
        function handleVisibilityChange() {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now()
            }
            if (document.visibilityState === 'visible' && mounted.current) {
                // Only trigger if we KNOW it was hidden and the gap exceeds threshold
                if (hiddenAt && (Date.now() - hiddenAt) >= 30_000) {
                    console.log('[AuthContext] Page woke after', Math.round((Date.now() - hiddenAt) / 1000), 's — refreshing session')
                    supabase.auth.refreshSession().catch(err => {
                        console.warn('[AuthContext] Session refresh failed:', err.message)
                    })
                }
                hiddenAt = null
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            mounted.current = false
            subscription.unsubscribe()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    const login = useCallback(async function login(email, password) {
        setState(prev => ({ ...prev, loading: true }))
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            setState(prev => ({ ...prev, loading: false }))
            throw error
        }
        if (data?.user) {
            await resolveAdmin(data.user)
        }
        return data
    }, [])

    const logout = useCallback(async function logout() {
        setState(prev => ({ ...prev, loading: true }))
        localStorage.removeItem('espetinho_admin_bypass')
        localStorage.removeItem('espetinho_admin_cache')
        await supabase.auth.signOut()
        if (mounted.current) {
            setState({ user: null, adminInfo: null, loading: false })
        }
    }, [])

    const value = useMemo(() => ({
        ...state,
        isAuthenticated: !!state.user && !!state.adminInfo,
        login,
        logout
    }), [state, login, logout])

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuthContext = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthProvider')
    }
    return context
}
