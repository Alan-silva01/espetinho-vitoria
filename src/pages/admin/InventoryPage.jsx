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
        total: 0,
        sales: 0,
        alerts: 0
    })
    const [activities, setActivities] = useState([])
    const [saving, setSaving] = useState(false)
    const [savingItem, setSavingItem] = useState(null)
    const [isFastEntry, setIsFastEntry] = useState(false)

    // Helper to normalize text (remove accents)
    const normalize = (text) => {
        return (text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    }

    // Smart search logic
    const matchesSearch = (item) => {
        if (!searchTerm) return true
        const searchNorm = normalize(searchTerm)
        const itemNorm = normalize(`${item.nome} ${item.categorias?.nome || ''}`)
        const queryWords = searchNorm.split(/\s+/).filter(w => w.length > 0)
        return queryWords.every(word => itemNorm.includes(word))
    }

    useEffect(() => {
        fetchInventory()
    }, [])

    async function fetchInventory() {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        // 1. Fetch products
        const { data: products } = await supabase
            .from('produtos')
            .select('id, nome, imagem_url, quantidade_disponivel, controlar_estoque, categorias(nome)')
            .order('nome')

        // 2. Fetch daily stock
        const { data: stockToday } = await supabase
            .from('estoque_diario')
            .select('*')
            .eq('data', today)

        // Merge data
        const merged = (products || []).map(p => {
            const stock = stockToday?.find(s => s.produto_id === p.id)
            const initial = stock?.quantidade_inicial || p.quantidade_disponivel || 0
            const current = p.quantidade_disponivel || 0
            const sold = stock ? stock.quantidade_inicial - stock.quantidade_atual : 0
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

        // 3. Update stats summary
        const totalStock = merged.reduce((acc, i) => acc + i.atual, 0)
        const totalSold = merged.reduce((acc, i) => acc + i.vendidos, 0)
        const lowStock = merged.filter(i => i.percentage < 20 && i.inicial > 0).length

        setStats({
            total: totalStock,
            sales: totalSold,
            alerts: lowStock
        })

        // 4. Fetch real activities (Recent Sales)
        const { data: recentItems } = await supabase
            .from('itens_pedido')
            .select('quantidade, produtos(nome), pedidos(id, numero_pedido, criado_em)')
            .order('id', { ascending: false })
            .limit(5)

        if (recentItems) {
            const formatted = recentItems.map(item => ({
                id: item.pedidos?.id,
                title: `Pedido #${item.pedidos?.numero_pedido}`,
                subtitle: `${item.quantidade}x ${item.produtos?.nome}`,
                time: new Date(item.pedidos?.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'blue'
            }))
            setActivities(formatted)
        }
    }

    const updateStock = (id, field, value) => {
        setInventory(prev => prev.map(item => {
            if (item.id === id) {
                // Allow empty string for better UX (so user can clear the input)
                const rawValue = value === "" ? "" : Math.max(0, parseInt(value) || 0)
                const numericValue = rawValue === "" ? 0 : rawValue

                const isInitial = field === 'inicial'

                // For percentage calculation
                const calcInitial = isInitial ? numericValue : (parseFloat(item.inicial) || 0)
                const calcCurrent = field === 'atual' ? numericValue : (isInitial ? numericValue : (parseFloat(item.atual) || 0))

                return {
                    ...item,
                    [field]: rawValue,
                    // If updating initial, we usually update current as well for the starting point
                    atual: isInitial ? rawValue : (field === 'atual' ? rawValue : item.atual),
                    percentage: calcInitial > 0 ? (calcCurrent / calcInitial) * 100 : 0,
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
            const finalInicial = parseInt(item.inicial) || 0
            const finalAtual = parseInt(item.atual) || 0

            // Update persistent stock in products table
            await supabase
                .from('produtos')
                .update({
                    quantidade_disponivel: finalAtual,
                    controlar_estoque: true // Auto-enable if saved in inventory page
                })
                .eq('id', item.id)

            // Update or create daily stock record for tracking
            if (item.stock_id) {
                await supabase
                    .from('estoque_diario')
                    .update({
                        quantidade_inicial: finalInicial,
                        quantidade_atual: finalAtual
                    })
                    .eq('id', item.stock_id)
            } else {
                await supabase
                    .from('estoque_diario')
                    .insert({
                        produto_id: item.id,
                        quantidade_inicial: finalInicial,
                        quantidade_atual: finalAtual,
                        data: today
                    })
            }
        }

        await fetchInventory()
        setSaving(false)
    }

    const handleImmediateOut = async (item) => {
        setSavingItem(item.id)
        try {
            const today = new Date().toISOString().split('T')[0]

            // 1. Update produtos (quantidade_disponivel = 0)
            await supabase
                .from('produtos')
                .update({
                    quantidade_disponivel: 0,
                    controlar_estoque: true
                })
                .eq('id', item.id)

            // 2. Update/Insert estoque_diario
            if (item.stock_id) {
                await supabase
                    .from('estoque_diario')
                    .update({ quantidade_atual: 0 })
                    .eq('id', item.stock_id)
            } else {
                await supabase
                    .from('estoque_diario')
                    .insert({
                        produto_id: item.id,
                        quantidade_inicial: item.inicial || 0,
                        quantidade_atual: 0,
                        data: today
                    })
            }

            // 3. Update local state e sync
            await fetchInventory()
        } catch (error) {
            console.error('Erro ao marcar como esgotado:', error)
        } finally {
            setSavingItem(null)
        }
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
                        className={`btn-toggle-fast ${isFastEntry ? 'active' : ''}`}
                        onClick={() => setIsFastEntry(!isFastEntry)}
                    >
                        {isFastEntry ? 'Vista Normal' : 'Ajuste Rápido'}
                    </button>
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

                    {/* Normal View or Fast Entry View */}
                    {isFastEntry ? (
                        <div className="fast-entry-container animate-fade-in">
                            <table className="fast-entry-table">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th>Categoria</th>
                                        <th style={{ width: '120px' }}>Estoque Atual</th>
                                        <th style={{ width: '100px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventory
                                        .filter(matchesSearch)
                                        .map(item => (
                                            <tr key={item.id} className={item.is_dirty ? 'dirty' : ''}>
                                                <td>
                                                    <div className="fast-prod-info">
                                                        <img src={item.imagem_url || 'https://via.placeholder.com/50'} alt="" />
                                                        <strong>{item.nome}</strong>
                                                    </div>
                                                </td>
                                                <td><span className="cat-pill">{item.categorias?.nome}</span></td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="fast-input"
                                                        value={item.atual}
                                                        onChange={e => updateStock(item.id, 'atual', e.target.value)}
                                                        min="0"
                                                    />
                                                </td>
                                                <td>
                                                    <span className={`status-text ${item.atual === 0 ? 'red' : item.percentage < 20 ? 'orange' : 'green'}`}>
                                                        {item.atual === 0 ? 'Esgotado' : item.percentage < 20 ? 'Baixo' : 'OK'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="inventory-sections">
                            {Object.entries(groupedInventory).map(([catName, items]) => (
                                <section key={catName} className="inventory-group">
                                    <div className="group-header">
                                        <h3>{catName}</h3>
                                        <button className="view-all">Ver todos <ChevronRight size={14} /></button>
                                    </div>
                                    <div className="inventory-grid-v2">
                                        {(items || [])
                                            .filter(matchesSearch)
                                            .map(item => (
                                                <div key={item.id} className={`inv-item-card ${item.atual === 0 ? 'empty' : item.percentage < 20 ? 'low' : ''} ${!item.controlar_estoque ? 'no-control' : ''}`}>
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

                                                        <button
                                                            className={`btn-out-manual ${item.atual === 0 ? 'is-out' : ''}`}
                                                            onClick={() => handleImmediateOut(item)}
                                                            disabled={savingItem === item.id}
                                                        >
                                                            {savingItem === item.id ? (
                                                                <>
                                                                    <RefreshCw size={14} className="animate-spin" />
                                                                    Salvando...
                                                                </>
                                                            ) : item.atual === 0 ? (
                                                                <>
                                                                    <CheckCircle2 size={14} />
                                                                    Produto Esgotado
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle size={14} />
                                                                    Marcar Esgotado
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>

                {/* Activity Sidebar */}
                <aside className="inventory-sidebar">
                    <h3>Atividades Recentes</h3>
                    <div className="activity-timeline">
                        {activities.length > 0 ? activities.map((act, idx) => (
                            <div key={idx} className={`activity-item ${act.type}`}>
                                <div className="marker" />
                                <div className="act-content">
                                    <p><strong>{act.title}</strong></p>
                                    <span>{act.subtitle}</span>
                                    <small>{act.time}</small>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-activities">Nenhuma atividade hoje.</div>
                        )}
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
