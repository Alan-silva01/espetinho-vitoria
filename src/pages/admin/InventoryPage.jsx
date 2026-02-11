import { useState, useEffect } from 'react'
import {
    Package, RefreshCw, Save, AlertTriangle,
    Search, Filter, ChevronUp, ChevronDown, CheckCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './InventoryPage.css'

export default function InventoryPage() {
    const [inventory, setInventory] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [lastSync, setLastSync] = useState(null)

    useEffect(() => {
        fetchInventory()
    }, [])

    async function fetchInventory() {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        // 1. Fetch products
        const { data: products } = await supabase
            .from('produtos')
            .select('id, nome, categorias(nome)')
            .order('nome')

        // 2. Fetch daily stock
        const { data: stockToday } = await supabase
            .from('estoque_diario')
            .select('*')
            .eq('data', today)

        // Merge data
        const merged = products.map(p => {
            const stock = stockToday?.find(s => s.produto_id === p.id)
            return {
                ...p,
                stock_id: stock?.id,
                quantidade_inicial: stock?.quantidade_inicial || 0,
                quantidade_atual: stock?.quantidade_atual || 0,
                is_dirty: false
            }
        })

        setInventory(merged)
        setLastSync(new Date())
        setLoading(false)
    }

    const handleUpdateStock = (productId, value) => {
        setInventory(prev => prev.map(item => {
            if (item.id === productId) {
                return {
                    ...item,
                    quantidade_inicial: parseInt(value) || 0,
                    is_dirty: true
                }
            }
            return item
        }))
    }

    async function saveChanges() {
        setSaving(true)
        const today = new Date().toISOString().split('T')[0]
        const dirtyItems = inventory.filter(p => p.is_dirty)

        for (const item of dirtyItems) {
            if (item.stock_id) {
                // Update
                await supabase
                    .from('estoque_diario')
                    .update({
                        quantidade_inicial: item.quantidade_inicial,
                        quantidade_atual: item.quantidade_inicial
                    })
                    .eq('id', item.stock_id)
            } else {
                // Insert
                await supabase
                    .from('estoque_diario')
                    .insert({
                        produto_id: item.id,
                        quantidade_inicial: item.quantidade_inicial,
                        quantidade_atual: item.quantidade_inicial,
                        data: today
                    })
            }
        }

        await fetchInventory()
        setSaving(false)
    }

    const filteredInventory = inventory.filter(item =>
        item.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return <div className="admin-loading">Carregando estoque...</div>

    return (
        <div className="inventory-container animate-fade-in">
            <header className="inventory-header">
                <div>
                    <h1>Estoque Diário</h1>
                    <p>Defina a quantidade disponível para venda hoje.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={fetchInventory}>
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        Sync {lastSync && lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={saveChanges}
                        disabled={saving || !inventory.some(i => i.is_dirty)}
                    >
                        <Save size={18} />
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </header>

            <div className="inventory-controls">
                <div className="search-bar">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="inventory-table-wrapper">
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th>Categoria</th>
                            <th>Estoque Inicial</th>
                            <th>Disponível Agora</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInventory.map(item => (
                            <tr key={item.id} className={item.is_dirty ? 'row-dirty' : ''}>
                                <td>
                                    <div className="product-info">
                                        <Package size={16} color="#9CA3AF" />
                                        <strong>{item.nome}</strong>
                                    </div>
                                </td>
                                <td><span className="cat-badge">{item.categorias?.nome}</span></td>
                                <td>
                                    <div className="stock-input-group">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.quantidade_inicial}
                                            onChange={(e) => handleUpdateStock(item.id, e.target.value)}
                                        />
                                        <div className="input-steppers">
                                            <button onClick={() => handleUpdateStock(item.id, item.quantidade_inicial + 1)}><ChevronUp size={12} /></button>
                                            <button onClick={() => handleUpdateStock(item.id, Math.max(0, item.quantidade_inicial - 1))}><ChevronDown size={12} /></button>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`stock-count ${item.quantidade_atual === 0 ? 'zero' : item.quantidade_atual < 5 ? 'low' : ''}`}>
                                        {item.quantidade_atual}
                                    </span>
                                </td>
                                <td>
                                    {item.quantidade_atual <= 0 ? (
                                        <div className="status-label out">
                                            <AlertTriangle size={14} /> Esgotado
                                        </div>
                                    ) : item.quantidade_atual < 5 ? (
                                        <div className="status-label low">
                                            <AlertTriangle size={14} /> Baixo
                                        </div>
                                    ) : (
                                        <div className="status-label ok">
                                            <CheckCircle size={14} /> Em estoque
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
