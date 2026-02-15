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

function cartReducer(state, action) {
    let newState
    switch (action.type) {
        case 'ADD_ITEM': {
            const key = `${action.item.produto_id}-${action.item.variacao_id || 'default'}-${action.item.observacoes || ''}`
            const existing = state.find(i =>
                `${i.produto_id}-${i.variacao_id || 'default'}-${i.observacoes || ''}` === key
            )
            if (existing) {
                newState = state.map(i =>
                    `${i.produto_id}-${i.variacao_id || 'default'}` === key
                        ? { ...i, quantidade: i.quantidade + (action.item.quantidade || 1) }
                        : i
                )
            } else {
                newState = [...state, { ...action.item, quantidade: action.item.quantidade || 1 }]
            }
            break
        }
        case 'REMOVE_ITEM': {
            const key = `${action.produto_id}-${action.variacao_id || 'default'}-${action.observacoes || ''}`
            newState = state.filter(i =>
                `${i.produto_id}-${i.variacao_id || 'default'}-${i.observacoes || ''}` !== key
            )
            break
        }
        case 'UPDATE_QTY': {
            const key = `${action.produto_id}-${action.variacao_id || 'default'}-${action.observacoes || ''}`
            if (action.quantidade <= 0) {
                newState = state.filter(i =>
                    `${i.produto_id}-${i.variacao_id || 'default'}-${i.observacoes || ''}` !== key
                )
            } else {
                newState = state.map(i =>
                    `${i.produto_id}-${i.variacao_id || 'default'}-${i.observacoes || ''}` === key
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
    const removeItem = (produto_id, variacao_id, observacoes) => dispatch({ type: 'REMOVE_ITEM', produto_id, variacao_id, observacoes })
    const updateQuantity = (produto_id, variacao_id, observacoes, quantidade) =>
        dispatch({ type: 'UPDATE_QTY', produto_id, variacao_id, observacoes, quantidade })
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
