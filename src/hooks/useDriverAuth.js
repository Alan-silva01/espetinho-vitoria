import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDriverAuth() {
    const [driver, setDriver] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const storedDriver = localStorage.getItem('espetinho_driver_session')
        if (storedDriver) {
            try {
                setDriver(JSON.parse(storedDriver))
            } catch (e) {
                console.error('Erro ao ler sessão do entregador')
            }
        }
        setLoading(false)
    }, [])

    async function login(identificador, senha) {
        setLoading(true)
        try {
            // Busca o entregador pelo nome ou telefone
            const { data, error } = await supabase
                .from('entregadores')
                .select('*')
                .or(`nome.eq."${identificador}",telefone.eq."${identificador}"`)
                .eq('senha', senha)
                .single()

            if (error || !data) {
                throw new Error('Login ou senha incorretos.')
            }

            const driverData = {
                id: data.id,
                nome: data.nome,
                telefone: data.telefone
            }

            setDriver(driverData)
            localStorage.setItem('espetinho_driver_session', JSON.stringify(driverData))
            return data
        } finally {
            setLoading(false)
        }
    }

    function logout() {
        setDriver(null)
        localStorage.removeItem('espetinho_driver_session')
    }

    return {
        driver,
        loading,
        isAuthenticated: !!driver,
        login,
        logout
    }
}
