import { createContext, useContext, useReducer, useEffect } from 'react'

const CartContext = createContext()

const STORAGE_KEY = 'espetinho-cart'

function loadCart() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    } catch { return [] }
}

function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function getPersonalizacaoKey(personalizacao) {
    if (!personalizacao || typeof personalizacao !== 'object') return ''
    try {
        const sortedKeys = Object.keys(personalizacao).sort()
        const parts = sortedKeys.map(k => {
            const val = personalizacao[k]
            let valStr = ''
            if (Array.isArray(val)) {
                valStr = [...val].sort().join(',')
            } else {
                valStr = String(val)
            }
            return `${k}:${valStr}`
        })
        return parts.join('|')
    } catch (e) {
        return JSON.stringify(personalizacao)
    }
}

export function getItemKey(item) {
    if (!item) return ''
    return `${item.produto_id}-${item.variacao_id || 'default'}-${getPersonalizacaoKey(item.personalizacao)}-${item.observacoes || ''}`
}

function cartReducer(state, action) {
    let newState
    switch (action.type) {
        case 'ADD_ITEM': {
            const key = getItemKey(action.item)
            const existing = state.find(i => getItemKey(i) === key)
            if (existing) {
                newState = state.map(i =>
                    getItemKey(i) === key
                        ? {
                            ...i,
                            quantidade: i.quantidade + (action.item.quantidade || 1),
                            eh_upsell: i.eh_upsell || action.item.eh_upsell
                        }
                        : i
                )
            } else {
                newState = [...state, { ...action.item, quantidade: action.item.quantidade || 1 }]
            }
            break
        }
        case 'REMOVE_ITEM': {
            const key = getItemKey(action.item)
            newState = state.filter(i => getItemKey(i) !== key)
            break
        }
        case 'UPDATE_QTY': {
            const key = getItemKey(action.item)
            if (action.quantidade <= 0) {
                newState = state.filter(i => getItemKey(i) !== key)
            } else {
                newState = state.map(i =>
                    getItemKey(i) === key
                        ? { ...i, quantidade: action.quantidade }
                        : i
                )
            }
            break
        }
        case 'CLEAR':
            newState = []
            break
        default:
            return state
    }
    saveCart(newState)
    return newState
}

export function CartProvider({ children }) {
    const [items, dispatch] = useReducer(cartReducer, [], loadCart)

    const addItem = (item) => dispatch({ type: 'ADD_ITEM', item })
    const removeItem = (item) => dispatch({ type: 'REMOVE_ITEM', item })
    const updateQuantity = (item, quantidade) =>
        dispatch({ type: 'UPDATE_QTY', item, quantidade })
    const clearCart = () => dispatch({ type: 'CLEAR' })

    const totalItems = items.reduce((sum, i) => sum + i.quantidade, 0)
    const subtotal = items.reduce((sum, i) => sum + (i.preco * i.quantidade), 0)
    const totalUpsell = items
        .filter(i => i.eh_upsell)
        .reduce((sum, i) => sum + (i.preco * i.quantidade), 0)

    return (
        <CartContext.Provider value={{
            items, addItem, removeItem, updateQuantity, clearCart,
            totalItems, subtotal, totalUpsell
        }}>
            {children}
        </CartContext.Provider>
    )
}

export function useCart() {
    const ctx = useContext(CartContext)
    if (!ctx) throw new Error('useCart must be used inside CartProvider')
    return ctx
}
