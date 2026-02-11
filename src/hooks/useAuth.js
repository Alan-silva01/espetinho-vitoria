import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
    const [user, setUser] = useState(null)
    const [adminInfo, setAdminInfo] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        /* Check current session */
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user)
                fetchAdminInfo(session.user.id)
            } else {
                setLoading(false)
            }
        })

        /* Listen for auth changes */
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    setUser(session.user)
                    await fetchAdminInfo(session.user.id)
                } else {
                    setUser(null)
                    setAdminInfo(null)
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    async function fetchAdminInfo(userId) {
        const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', userId)
            .single()

        if (!error && data) {
            setAdminInfo(data)
        }
        setLoading(false)
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
        await supabase.auth.signOut()
        setUser(null)
        setAdminInfo(null)
    }

    return {
        user, adminInfo, loading,
        isAuthenticated: !!user && !!adminInfo,
        login, logout,
    }
}
