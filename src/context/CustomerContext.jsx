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

    async function updateCustomerData(newData, explicitId = null) {
        const targetId = explicitId || customer?.id
        if (!targetId) return

        // 1. Prepare top-level columns to update
        const toUpdate = {}
        if (newData.nome) toUpdate.nome = newData.nome
        if (newData.telefone) toUpdate.telefone = newData.telefone

        // 2. Resolve current 'dados' to merge
        let currentDados = customer?.dados || {}

        // If we have an explicit ID but no 'customer' state (new user flow), 
        // we might need to fetch current 'dados' or just overwrite/merge carefully.
        // For simplicity and to avoid race conditions, let's treat 'newData' 
        // as the updates for the 'dados' column if it's not a top-level column.

        const { nome, telefone, ...onlyDados } = newData

        const updatedDados = {
            ...currentDados,
            ...onlyDados
        }

        toUpdate.dados = updatedDados

        const { error } = await supabase
            .from('clientes')
            .update(toUpdate)
            .eq('id', targetId)

        if (!error) {
            // Update local state if it matches the current customer
            if (customer && customer.id === targetId) {
                setCustomer(prev => ({
                    ...prev,
                    ...toUpdate,
                    dados: updatedDados
                }))
            }
            return true
        }
        return false
    }

    async function updateLastOrder(orderSummary, newAddress = null, explicitId = null, extraInfo = {}) {
        const targetId = explicitId || customer?.id
        if (!targetId) return

        const updateObj = {
            ultimos_pedidos: orderSummary,
            ...extraInfo
        }

        if (newAddress) {
            updateObj.endereco = newAddress
            // Also update top-level receiver name/phone if available
            if (newAddress.nome_recebedor) updateObj.nome = newAddress.nome_recebedor
            if (newAddress.telefone_recebedor) updateObj.telefone = newAddress.telefone_recebedor
        }

        await updateCustomerData(updateObj, targetId)
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
