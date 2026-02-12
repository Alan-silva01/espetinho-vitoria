import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CustomerContext = createContext()

export function CustomerProvider({ children }) {
    const [customer, setCustomer] = useState(null)
    const [loading, setLoading] = useState(true)

    // Load from localStorage on mount
    useEffect(() => {
        const savedId = localStorage.getItem('espetinho_customer_id')
        if (savedId) {
            fetchCustomerById(savedId)
        } else {
            setLoading(false)
        }
    }, [])

    async function fetchCustomerByCode(code) {
        if (!code) return

        // If switching customers, clear manual override flag
        const currentId = localStorage.getItem('espetinho_customer_id')

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('codigo', code)
                .single()

            if (data && !error) {
                // If it's a DIFFERENT customer than before, reset manual address preference
                if (currentId !== data.id) {
                    localStorage.removeItem('espetinho_manual_address')
                }

                setCustomer(data)
                localStorage.setItem('espetinho_customer_id', data.id)

                // Also update delivery data if we have it in 'dados'
                if (data.dados?.endereco) {
                    localStorage.setItem('espetinho_delivery_data', JSON.stringify({
                        receiverName: data.dados.nome || data.nome,
                        receiverPhone: data.dados.whatsapp || data.telefone,
                        ...data.dados.endereco
                    }))
                }
            }
        } catch (err) {
            console.error('[fetchCustomerByCode] Erro:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchCustomerById(id) {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', id)
                .single()

            if (data && !error) {
                setCustomer(data)
            }
        } catch (err) {
            console.error('[fetchCustomerById] Erro:', err)
        } finally {
            setLoading(false)
        }
    }

    async function updateLastOrder(orderSummary, newAddress = null) {
        if (!customer) return

        const updatedDados = {
            ...customer.dados,
            ultimos_pedidos: orderSummary,
            ...(newAddress && { endereco: newAddress })
        }

        const { error } = await supabase
            .from('clientes')
            .update({ dados: updatedDados })
            .eq('id', customer.id)

        if (!error) {
            setCustomer(prev => ({ ...prev, dados: updatedDados }))
        }
    }

    return (
        <CustomerContext.Provider value={{
            customer,
            loading,
            fetchCustomerByCode,
            updateLastOrder
        }}>
            {children}
        </CustomerContext.Provider>
    )
}

export const useCustomer = () => useContext(CustomerContext)
