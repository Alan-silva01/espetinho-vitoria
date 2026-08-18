import { useState, useEffect, useCallback } from 'react'
import {
    DollarSign, ShoppingBag, Users, Heart,
    TrendingUp, ArrowUpRight, ArrowDownRight,
    Flame, Award, Clock, Receipt, Stars, Calendar,
    BarChart3, ChevronRight, MoreHorizontal,
    Utensils, Truck, Check, Search, Bell
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { DashboardSkeleton } from '../../components/ui/SkeletonLoader'
import './DashboardPage.css'



export default function DashboardPage() {
    const [stats, setStats] = useState({
        revenue: 0,
        revenueDiff: 0,
        orders: 0,
        newOrdersLastHour: 0,
        ticket: 0,
        upsell: 0,
        itemCount: {
            espetos: 0,
            acaiTradicional: 0,
            acaiEspecial: 0,
            refrigerantes: 0
        }
    })
    const [timeframe, setTimeframe] = useState('7') // '7' ou '30' dias
    const [topProducts, setTopProducts] = useState([])
    const [recentOrders, setRecentOrders] = useState([])
    const [categorySales, setCategorySales] = useState([])
    const [lowStockProducts, setLowStockProducts] = useState([])
    const [chartData, setChartData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchDashboardData()
    }, [timeframe])

    // Wake-from-sleep: re-fetch dashboard metrics silently (no loading spinner)
    useVisibilityRefresh(useCallback(() => {
        console.log('[Dashboard] Woke from sleep — refreshing metrics silently')
        fetchDashboardData(true)
    }, []))

    async function fetchDashboardData(isSilent = false) {
        if (!isSilent) {
            setLoading(true)
            setError(null)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        try {
            // Use São Paulo timezone for all date boundaries
            const spNow = new Date()
            const spDateStr = spNow.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // 'YYYY-MM-DD'
            const today = new Date(spDateStr + 'T00:00:00-03:00') // Midnight in SP

            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)

            const daysToFetch = parseInt(timeframe)
            const startDate = new Date(today)
            startDate.setDate(startDate.getDate() - daysToFetch)

            // For revenue comparison, we need at least since yesterday
            const fetchFrom = startDate < yesterday ? startDate : yesterday

            // 1. Fetch Orders for Stats and Chart
            const { data: orders, error: ordersErr } = await supabase
                .from('pedidos')
                .select(`
                    id, valor_total, criado_em, status, 
                    nome_cliente, numero_pedido, tipo_pedido,
                    itens:itens_pedido(
                        quantidade,
                        eh_upsell,
                        produtos(id, nome, imagem_url, categoria_id, categorias(nome))
                    )
                `)
                .gte('criado_em', fetchFrom.toISOString())
                .abortSignal(controller.signal)

            if (ordersErr) throw ordersErr

            // Metrics for TODAY (exclude cancelled)
            const todayOrders = orders?.filter(o => new Date(o.criado_em) >= today && o.status !== 'cancelado') || []
            const totalRevenue = todayOrders.reduce((acc, curr) => acc + Number(curr.valor_total), 0)
            const totalOrdersCount = todayOrders.length
            const avgTicket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0

            // New orders last hour
            const oneHourAgo = new Date(spNow.getTime() - (60 * 60 * 1000))
            const newOrdersLastHour = todayOrders.filter(o => new Date(o.criado_em) >= oneHourAgo).length

            // Revenue Comparison (vs Ontem)
            const yesterdayOrders = orders?.filter(o => {
                const d = new Date(o.criado_em)
                return d >= yesterday && d < today && o.status !== 'cancelado'
            }) || []
            const yesterdayRevenue = yesterdayOrders.reduce((acc, curr) => acc + Number(curr.valor_total), 0)

            let revenueDiff = 0
            if (yesterdayRevenue > 0) {
                revenueDiff = ((totalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
            } else if (totalRevenue > 0) {
                revenueDiff = 100
            }

            // Real Upsell Rate Calculation
            const ordersWithUpsell = orders?.filter(o => o.itens?.some(i => i.eh_upsell)).length || 0
            const realUpsellRate = orders?.length > 0 ? (ordersWithUpsell / orders.length) * 100 : 0

            // 2. Chart Data (timezone-aware)
            const chartNodes = Array.from({ length: daysToFetch }, (_, i) => {
                const date = new Date(today)
                date.setDate(date.getDate() - (daysToFetch - 1 - i))
                return {
                    name: daysToFetch > 7
                        ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
                        : date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', ''),
                    fullDate: date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
                    valor: 0
                }
            })

            orders.filter(o => o.status !== 'cancelado').forEach(order => {
                const orderDate = new Date(order.criado_em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                const day = chartNodes.find(d => d.fullDate === orderDate)
                if (day) {
                    day.valor += Number(order.valor_total)
                }
            })

            // 2. Volumetric Counts for TODAY (to match top cards)
            const todayCounts = {
                espetos: 0,
                acaiTradicional: 0,
                acaiEspecial: 0,
                refrigerantes: 0
            }

            todayOrders?.forEach(order => {
                order.itens?.forEach(item => {
                    const prodName = item.produtos?.nome || ''
                    const catName = item.produtos?.categorias?.nome || ''
                    const qty = item.quantidade || 0

                    if (catName === 'Espetinhos') {
                        todayCounts.espetos += qty
                    } else if (prodName === 'Açaí Tradicional') {
                        todayCounts.acaiTradicional += qty
                    } else if (prodName === 'Açaí Especial') {
                        todayCounts.acaiEspecial += qty
                    } else if (prodName.toLowerCase().startsWith('refrigerante')) {
                        todayCounts.refrigerantes += qty
                    }
                })
            })

            // Set stats
            setStats({
                revenue: totalRevenue,
                revenueDiff: revenueDiff,
                orders: totalOrdersCount,
                newOrdersLastHour: newOrdersLastHour,
                ticket: avgTicket,
                upsell: realUpsellRate.toFixed(1),
                itemCount: todayCounts
            })

            setRecentOrders(orders.slice(0, 4))
            setChartData(chartNodes)

            // 3. Category Breakdown
            const catMap = {}
            let totalItems = 0
            orders.forEach(order => {
                order.itens?.forEach(item => {
                    const catName = item.produtos?.categorias?.nome || 'Outros'
                    catMap[catName] = (catMap[catName] || 0) + item.quantidade
                    totalItems += item.quantidade
                })
            })

            const categoryData = Object.entries(catMap).map(([name, count]) => ({
                name,
                percent: Math.round((count / totalItems) * 100),
                color: name === 'Espetinhos' ? '#B91C1C' : name === 'Bebidas' ? '#3B82F6' : '#F59E0B'
            })).sort((a, b) => b.percent - a.percent)

            setCategorySales(categoryData)

            // 4. Top Products
            const prodMap = {}
            orders.forEach(order => {
                order.itens?.forEach(item => {
                    const prodId = item.produtos?.id
                    if (!prodId) return
                    if (!prodMap[prodId]) {
                        prodMap[prodId] = {
                            id: prodId,
                            nome: item.produtos.nome,
                            imagem_url: item.produtos.imagem_url,
                            categoria: item.produtos.categorias?.nome,
                            vendas: 0
                        }
                    }
                    prodMap[prodId].vendas += item.quantidade
                })
            })

            setTopProducts(Object.values(prodMap).sort((a, b) => b.vendas - a.vendas).slice(0, 5))

            // 5. Low Stock Alerts
            const { data: lowStockData, error: stockErr } = await supabase
                .from('produtos')
                .select('id, nome, quantidade_disponivel, imagem_url')
                .eq('controlar_estoque', true)
                .lte('quantidade_disponivel', 5)
                .order('quantidade_disponivel', { ascending: true })
                .abortSignal(controller.signal)

            if (stockErr) throw stockErr
            setLowStockProducts(lowStockData || [])

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('[Dashboard] Request timed out')
            } else {
                console.error('[Dashboard] Erro ao carregar dados:', error)
            }
            if (!isSilent) {
                setError('Falha ao sincronizar métricas.')
            }
        } finally {
            clearTimeout(timeoutId)
            setLoading(false)
        }
    }


    if (loading) return <DashboardSkeleton />

    if (error) {
        return (
            <div className="admin-error-state">
                <BarChart3 size={48} />
                <h3>Painel Indisponível</h3>
                <p>{error}</p>
                <button onClick={fetchDashboardData} className="btn-retry">
                    <TrendingUp size={18} />
                    Tentar Novamente
                </button>
            </div>
        )
    }

    return (
        <div className="dashboard-wrapper animate-fade-in">
            <header className="dashboard-header-premium">
                <div className="header-titles">
                    <h1>Visão Geral</h1>
                    <p>Olá, Aqui está o resumo de hoje.</p>
                </div>
                <div className="header-actions">
                    <div className="search-pill">
                        <Search size={16} />
                        <input type="text" placeholder="Buscar pedidos, clientes..." />
                    </div>
                    <button className="icon-badge">
                        <Bell size={20} />
                        <span className="dot"></span>
                    </button>
                </div>
            </header>

            <div className="dashboard-scrollable hide-scrollbar">
                {/* Metrics Grid */}
                <div className="metrics-grid">
                    <div className="metric-card primary">
                        <div className="card-overlay" />
                        <div className="card-header">
                            <div className="icon-wrapper">
                                <Calendar size={20} />
                            </div>
                            <button className="more-btn"><MoreHorizontal size={18} /></button>
                        </div>
                        <div className="card-content">
                            <p className="card-label">Vendas Hoje</p>
                            <h3 className="card-value">{formatCurrency(stats.revenue)}</h3>
                            <div className="card-footer">
                                <span className={`trend-badge ${stats.revenueDiff < 0 ? 'trend-negative' : ''}`}>
                                    {stats.revenueDiff >= 0 ? <TrendingUp size={12} /> : <TrendingUp size={12} style={{ transform: 'rotate(180deg)' }} />}
                                    {stats.revenueDiff >= 0 ? '+' : ''}{stats.revenueDiff.toFixed(0)}%
                                </span>
                                <span className="trend-text">vs. ontem</span>
                            </div>
                        </div>
                    </div>

                    <div className="metric-card standard">
                        <div className="card-header">
                            <div className="icon-wrapper blue">
                                <Receipt size={20} />
                            </div>
                        </div>
                        <div className="card-content">
                            <p className="card-label">Pedidos Hoje</p>
                            <h3 className="card-value">{stats.orders}</h3>
                            <div className="card-footer">
                                <span className="trend-positive">{stats.newOrdersLastHour} novos</span>
                                <span className="trend-text">última hora</span>
                            </div>
                        </div>
                    </div>

                    <div className="metric-card standard">
                        <div className="card-header">
                            <div className="icon-wrapper orange">
                                <DollarSign size={20} />
                            </div>
                        </div>
                        <div className="card-content">
                            <p className="card-label">Ticket Médio</p>
                            <h3 className="card-value">{formatCurrency(stats.ticket)}</h3>
                            <div className="card-footer">
                                <span className="trend-stable">Estável</span>
                            </div>
                        </div>
                    </div>

                    <div className="metric-card standard">
                        <div className="card-header">
                            <div className="icon-wrapper purple">
                                <Stars size={20} />
                            </div>
                            <div className="circular-progress">
                                <svg className="circular-svg" viewBox="0 0 36 36">
                                    <path className="bg-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="progress-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ strokeDasharray: `${stats.upsell}, 100` }} />
                                </svg>
                                <span>OK</span>
                            </div>
                        </div>
                        <div className="card-content">
                            <p className="card-label">Taxa de Upsell</p>
                            <div className="value-row">
                                <h3 className="card-value">{stats.upsell}%</h3>
                                <span className="sub-value">conversão</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Period Volumetric Highlights (Requested) */}
                <div className="metrics-grid volumetric-row">
                    <div className="metric-card minimal red">
                        <div className="card-content">
                            <p className="card-label">Espetinhos</p>
                            <div className="value-row">
                                <h3 className="card-value">{stats.itemCount.espetos}</h3>
                                <Flame size={16} className="text-red-500" />
                            </div>
                            <span className="trend-text">hoje</span>
                        </div>
                    </div>
                    <div className="metric-card minimal purple">
                        <div className="card-content">
                            <p className="card-label">Açaí Tradicional</p>
                            <div className="value-row">
                                <h3 className="card-value">{stats.itemCount.acaiTradicional}</h3>
                                <div className="dot purple" />
                            </div>
                            <span className="trend-text">hoje</span>
                        </div>
                    </div>
                    <div className="metric-card minimal purple-light">
                        <div className="card-content">
                            <p className="card-label">Açaí Especial</p>
                            <div className="value-row">
                                <h3 className="card-value">{stats.itemCount.acaiEspecial}</h3>
                                <Stars size={16} className="text-purple-400" />
                            </div>
                            <span className="trend-text">hoje</span>
                        </div>
                    </div>
                    <div className="metric-card minimal blue">
                        <div className="card-content">
                            <p className="card-label">Refrigerantes</p>
                            <div className="value-row">
                                <h3 className="card-value">{stats.itemCount.refrigerantes}</h3>
                                <ShoppingBag size={16} className="text-blue-500" />
                            </div>
                            <span className="trend-text">hoje</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-content-grid">
                    <div className="main-stats-column">
                        {/* Chart Card */}
                        <div className="chart-card-premium">
                            <div className="chart-header">
                                <h3>Vendas ({timeframe === '7' ? '7 dias' : '30 dias'})</h3>
                                <select
                                    value={timeframe}
                                    onChange={(e) => setTimeframe(e.target.value)}
                                >
                                    <option value="7">Última semana</option>
                                    <option value="30">Último mês</option>
                                </select>
                            </div>
                            <div className="chart-container-inner">
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#B91C1C" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#B91C1C" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            cursor={{ stroke: '#B91C1C', strokeWidth: 2, strokeDasharray: '5 5' }}
                                            formatter={(value) => [formatCurrency(value), 'Valor']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="valor"
                                            stroke="#B91C1C"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorValor)"
                                        />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Orders Table-Style */}
                        <div className="recent-orders-card">
                            <div className="card-header">
                                <h3>Últimos Pedidos</h3>
                                <button className="view-all">Ver todos</button>
                            </div>
                            <div className="orders-list">
                                {recentOrders.map(order => (
                                    <div key={order.id} className="order-row-item">
                                        <div className="order-icon-wrapper">
                                            {order.tipo_pedido === 'entrega' ? <Truck size={18} /> : (order.tipo_pedido === 'retirada' ? <ShoppingBag size={18} /> : <Utensils size={18} />)}
                                        </div>
                                        <div className="order-main-info">
                                            <p className="order-name">
                                                {order.nome_cliente || 'Cliente'}
                                                <span className="order-type-tiny">
                                                    ({order.tipo_pedido === 'entrega' ? 'Entrega' : (order.tipo_pedido === 'retirada' ? 'Retirada' : 'Mesa')})
                                                </span>
                                            </p>
                                            <p className="order-meta">ped: {order.numero_pedido} • {new Date(order.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="order-right-info">
                                            <span className={`status-tag ${order.status}`}>{order.status === 'saiu_entrega' ? 'saiu para entrega' : order.status}</span>
                                            <p className="order-total">{formatCurrency(order.valor_total)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-stats-column">
                        {/* Stock Alerts Card */}
                        {lowStockProducts.length > 0 && (
                            <div className="stats-box-card alerts-card">
                                <div className="card-header">
                                    <h3>Alertas de Estoque</h3>
                                    <span className="dot animate-pulse"></span>
                                </div>
                                <div className="category-bars">
                                    {lowStockProducts.map(p => (
                                        <div key={p.id} className="progress-item alert-item">
                                            <div className="progress-info">
                                                <span>{p.nome}</span>
                                                <strong className="text-red-600">{p.quantidade_disponivel} rest</strong>
                                            </div>
                                            <div className="progress-bg">
                                                <div
                                                    className="progress-fill"
                                                    style={{
                                                        width: `${(p.quantidade_disponivel / 5) * 100}%`,
                                                        backgroundColor: '#EF4444'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Category Breakdown */}
                        <div className="stats-box-card">
                            <div className="card-header">
                                <h3>Por Categoria</h3>
                                <MoreHorizontal size={18} color="#9CA3AF" />
                            </div>
                            <div className="category-bars">
                                {categorySales.map(cat => (
                                    <div key={cat.name} className="progress-item">
                                        <div className="progress-info">
                                            <span>{cat.name}</span>
                                            <strong>{cat.percent}%</strong>
                                        </div>
                                        <div className="progress-bg">
                                            <div className="progress-fill" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="stats-box-card">
                            <div className="card-header">
                                <h3>Mais Vendidos</h3>
                            </div>
                            <div className="top-products-vertical">
                                {topProducts.map(p => (
                                    <div key={p.id} className="top-product-row group">
                                        <div className="product-img">
                                            <img src={p.imagem_url || 'https://via.placeholder.com/50'} alt={p.nome} />
                                        </div>
                                        <div className="product-info">
                                            <h4 className="group-hover:text-primary">{p.nome}</h4>
                                            <p>{p.categoria}</p>
                                        </div>
                                        <div className="product-sales">
                                            <span className="sales-num">{p.vendas}</span>
                                            <span className="sales-unit">unid.</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
