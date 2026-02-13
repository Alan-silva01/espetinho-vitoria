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
                if (data.dados?.endereco || data.dados) {
                    const dbAddr = data.dados.endereco || data.dados || {}
                    localStorage.setItem('espetinho_delivery_data', JSON.stringify({
                        nome_recebedor: data.dados.nome_recebedor || data.dados.receiverName || data.dados.nome || data.nome || '',
                        telefone_recebedor: data.dados.telefone_recebedor || data.dados.receiverPhone || data.dados.whatsapp || data.telefone || '',
                        rua: dbAddr.rua || dbAddr.street || dbAddr.logradouro || '',
                        numero: dbAddr.numero || dbAddr.number || '',
                        bairro: dbAddr.bairro || dbAddr.neighborhood || '',
                        referencia: dbAddr.referencia || dbAddr.reference || dbAddr.ponto_referencia || ''
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

    async function updateCustomerData(newData) {
        if (!customer) return

        const updatedDados = {
            ...customer.dados,
            ...newData
        }

        const { error } = await supabase
            .from('clientes')
            .update({ dados: updatedDados })
            .eq('id', customer.id)

        if (!error) {
            setCustomer(prev => ({ ...prev, dados: updatedDados }))
            return true
        }
        return false
    }

    async function updateLastOrder(orderSummary, newAddress = null) {
        if (!customer) return

        const updateObj = {
            ultimos_pedidos: orderSummary
        }

        if (newAddress) {
            updateObj.endereco = newAddress
        }

        await updateCustomerData(updateObj)
    }

    return (
        <CustomerContext.Provider value={{
            customer,
            loading,
            fetchCustomerByCode,
            updateCustomerStatus: () => { }, // placeholder if needed
            updateCustomerData,
            updateLastOrder
        }}>
            {children}
        </CustomerContext.Provider>
    )
}

export const useCustomer = () => useContext(CustomerContext)
