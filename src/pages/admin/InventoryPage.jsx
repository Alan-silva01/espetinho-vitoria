import { useState, useEffect } from 'react'
import {
    Search, Plus, Filter, ArrowUpRight,
    ArrowDownRight, AlertTriangle, Package,
    ShoppingCart, ChevronRight, MoreVertical,
    CheckCircle2, XCircle, RefreshCw, Save,
    History, Download
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './InventoryPage.css'

export default function InventoryPage() {
    const [inventory, setInventory] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [stats, setStats] = useState({
        total: 1248,
        sales: 342,
        alerts: 4
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchInventory()
    }, [])

    async function fetchInventory() {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        // 1. Fetch products
        const { data: products } = await supabase
            .from('produtos')
            .select('id, nome, imagem_url, categorias(nome)')
            .order('nome')

        // 2. Fetch daily stock
        const { data: stockToday } = await supabase
            .from('estoque_diario')
            .select('*')
            .eq('data', today)

        // Merge data
        const merged = (products || []).map(p => {
            const stock = stockToday?.find(s => s.produto_id === p.id)
            const initial = stock?.quantidade_inicial || 0
            const current = stock?.quantidade_atual || 0
            const sold = initial - current
            const percentage = initial > 0 ? (current / initial) * 100 : 0

            return {
                ...p,
                stock_id: stock?.id,
                inicial: initial,
                atual: current,
                vendidos: sold > 0 ? sold : 0,
                percentage: percentage,
                is_dirty: false
            }
        })

        setInventory(merged)
        setLoading(false)

        // Update stats summary
        const lowStock = merged.filter(i => i.percentage < 20 && i.inicial > 0).length
        setStats(prev => ({ ...prev, alerts: lowStock }))
    }

    const updateStock = (id, field, value) => {
        setInventory(prev => prev.map(item => {
            if (item.id === id) {
                const newValue = Math.max(0, parseInt(value) || 0)
                const isInitial = field === 'inicial'
                const newInitial = isInitial ? newValue : item.inicial
                const newCurrent = isInitial ? newValue : newValue // If updating current directly (manual adjustment)

                return {
                    ...item,
                    [field]: newValue,
                    atual: isInitial ? newValue : newValue,
                    percentage: newInitial > 0 ? (newCurrent / newInitial) * 100 : 0,
                    is_dirty: true
                }
            }
            return item
        }))
    }

    const saveChanges = async () => {
        setSaving(true)
        const today = new Date().toISOString().split('T')[0]
        const dirtyItems = inventory.filter(p => p.is_dirty)

        for (const item of dirtyItems) {
            if (item.stock_id) {
                await supabase
                    .from('estoque_diario')
                    .update({
                        quantidade_inicial: item.inicial,
                        quantidade_atual: item.atual
                    })
                    .eq('id', item.stock_id)
            } else {
                await supabase
                    .from('estoque_diario')
                    .insert({
                        produto_id: item.id,
                        quantidade_inicial: item.inicial,
                        quantidade_atual: item.atual,
                        data: today
                    })
            }
        }

        await fetchInventory()
        setSaving(false)
    }

    const groupedInventory = inventory.reduce((acc, item) => {
        const catName = item.categorias?.nome || 'Sem Categoria'
        if (!acc[catName]) acc[catName] = []
        acc[catName].push(item)
        return acc
    }, {})

    if (loading) return <div className="admin-loading">Carregando estoque...</div>

    return (
        <div className="inventory-wrapper animate-fade-in">
            <header className="inventory-header-premium">
                <div className="header-titles">
                    <h1>Controle de Estoque</h1>
                    <p>Gerenciamento diário de produtos</p>
                </div>
                <div className="header-actions">
                    <div className="sync-info">
                        <RefreshCw size={14} />
                        <span>Última sincronização: Agora</span>
                    </div>
                    <button
                        className={`btn-save ${inventory.some(i => i.is_dirty) ? 'active' : ''}`}
                        onClick={saveChanges}
                        disabled={saving || !inventory.some(i => i.is_dirty)}
                    >
                        {saving ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
                    </button>
                </div>
            </header>

            <div className="inventory-layout-grid">
                <div className="inventory-main-content">
                    {/* Search and Quick Filters */}
                    <div className="inventory-toolbar">
                        <div className="search-bar-v2">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar produto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn-filter"><Filter size={18} /> Filtros</button>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="inventory-stats-row">
                        <div className="inv-stat-card gray">
                            <div className="stat-info">
                                <span>Total em Estoque</span>
                                <h3>{inventory.reduce((acc, i) => acc + i.atual, 0)} <small>unid.</small></h3>
                            </div>
                            <div className="stat-icon"><Package /></div>
                        </div>
                        <div className="inv-stat-card green">
                            <div className="stat-info">
                                <span>Vendidos Hoje</span>
                                <h3>{inventory.reduce((acc, i) => acc + i.vendidos, 0)} <small>unid.</small></h3>
                            </div>
                            <div className="stat-icon"><ShoppingCart /></div>
                        </div>
                        <div className="inv-stat-card red">
                            <div className="stat-info">
                                <span>Alertas de Baixa</span>
                                <h3>{stats.alerts} <small>produtos</small></h3>
                            </div>
                            <div className="stat-icon"><AlertTriangle /></div>
                        </div>
                    </div>

                    {/* Grouped Products Sections */}
                    <div className="inventory-sections">
                        {Object.entries(groupedInventory).map(([catName, items]) => (
                            <section key={catName} className="inventory-group">
                                <div className="group-header">
                                    <h3>{catName}</h3>
                                    <button className="view-all">Ver todos <ChevronRight size={14} /></button>
                                </div>
                                <div className="inventory-grid-v2">
                                    {(items || [])
                                        .filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map(item => (
                                            <div key={item.id} className={`inv-item-card ${item.atual === 0 ? 'empty' : item.percentage < 20 ? 'low' : ''}`}>
                                                <div className="item-img-box">
                                                    <img src={item.imagem_url || 'https://via.placeholder.com/150'} alt={item.nome} />
                                                    <div className="stock-label">
                                                        {item.atual === 0 ? 'Esgotado' : item.percentage < 20 ? 'Baixo Estoque' : 'Em Estoque'}
                                                    </div>
                                                </div>
                                                <div className="item-details">
                                                    <div className="item-title">
                                                        <h4>{item.nome}</h4>
                                                        <span className="sku">#ESP-{item.id.toString().slice(0, 2)}</span>
                                                    </div>

                                                    <div className="stock-metrics">
                                                        <div className="metric-box">
                                                            <span className="label">Inicial</span>
                                                            <input
                                                                type="number"
                                                                value={item.inicial}
                                                                onChange={e => updateStock(item.id, 'inicial', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="metric-box blue">
                                                            <span className="label">Vendidos</span>
                                                            <span className="val">{item.vendidos}</span>
                                                        </div>
                                                        <div className="metric-box green">
                                                            <span className="label">Atual</span>
                                                            <span className="val">{item.atual}</span>
                                                        </div>
                                                    </div>

                                                    <div className="stock-progress">
                                                        <div className="progress-info">
                                                            <span>Status</span>
                                                            <span>{Math.round(item.percentage)}%</span>
                                                        </div>
                                                        <div className="progress-bar">
                                                            <div
                                                                className="fill"
                                                                style={{
                                                                    width: `${item.percentage}%`,
                                                                    background: item.percentage < 20 ? '#EF4444' : item.percentage < 50 ? '#F59E0B' : '#10B981'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <button className="btn-out-manual">
                                                        <XCircle size={14} /> Marcar Esgotado
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>

                {/* Activity Sidebar */}
                <aside className="inventory-sidebar">
                    <h3>Atividades Recentes</h3>
                    <div className="activity-timeline">
                        <div className="activity-item green">
                            <div className="marker" />
                            <div className="act-content">
                                <p><strong>Admin</strong> registrou entrada</p>
                                <span>20x Espeto Carne</span>
                                <small>10 min atrás</small>
                            </div>
                        </div>
                        <div className="activity-item blue">
                            <div className="marker" />
                            <div className="act-content">
                                <p><strong>Venda #1042</strong> confirmada</p>
                                <span>3x Espetos + 1x Refri</span>
                                <small>22 min atrás</small>
                            </div>
                        </div>
                        <div className="activity-item red">
                            <div className="marker" />
                            <div className="act-content">
                                <p><strong>Coração</strong> esgotou!</p>
                                <small>45 min atrás</small>
                            </div>
                        </div>
                    </div>

                    <div className="report-box">
                        <h4>Relatório do Dia</h4>
                        <p>Exportar o controle de estoque de hoje em PDF.</p>
                        <button className="btn-download">
                            <Download size={16} /> Baixar PDF
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    )
}
