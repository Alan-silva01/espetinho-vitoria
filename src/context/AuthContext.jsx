import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [state, setState] = useState({
        user: null,
        adminInfo: null,
        loading: true
    })
    const mounted = useRef(true)
    const initializedRef = useRef(false)

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
                setState({
                    user: authUser,
                    adminInfo: {
                        id: authUser.id,
                        nome: 'Admin Teste',
                        email: 'teste@gmail.com',
                        cargo: 'dono',
                        permissoes: { all: true }
                    },
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
                setState({
                    user: authUser,
                    adminInfo: data || null,
                    loading: false
                })
                if (error || !data) {
                    console.warn('[AuthContext] Não é um admin:', error?.message)
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
            if (mounted.current) {
                setState({ user: null, adminInfo: null, loading: false })
            }
            initializedRef.current = true
        } catch (err) {
            console.error('[AuthContext] Erro na inicialização:', err)
            if (mounted.current) setState(prev => ({ ...prev, loading: false }))
            initializedRef.current = true
        }
    }

    useEffect(() => {
        mounted.current = true
        init()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!initializedRef.current || !mounted.current) return

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) await resolveAdmin(session.user)
            } else if (event === 'SIGNED_OUT') {
                if (mounted.current) {
                    setState({ user: null, adminInfo: null, loading: false })
                }
            }
        })

        return () => {
            mounted.current = false
            subscription.unsubscribe()
        }
    }, [])

    async function login(email, password) {
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
    }

    async function logout() {
        setState(prev => ({ ...prev, loading: true }))
        localStorage.removeItem('espetinho_admin_bypass')
        await supabase.auth.signOut()
        if (mounted.current) {
            setState({ user: null, adminInfo: null, loading: false })
        }
    }

    const value = {
        ...state,
        isAuthenticated: !!state.user && !!state.adminInfo,
        login,
        logout,
        checkBypass: async () => {
            // Force a re-check for the bypass login if needed
            initializedRef.current = false
            // (Re-init logic could go here if needed)
        }
    }

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
