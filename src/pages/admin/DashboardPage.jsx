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

            // Para comparar com o período anterior, buscamos 2x o período
            const previousPeriodStart = new Date(today)
            previousPeriodStart.setDate(previousPeriodStart.getDate() - (daysToFetch * 2))

            const fetchFrom = previousPeriodStart < yesterday ? previousPeriodStart : yesterday

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

            // Real Upsell Rate Calculation (Baseado nos pedidos ativos de HOJE)
            const ordersWithUpsell = todayOrders.filter(o => o.itens?.some(i => i.eh_upsell)).length
            const realUpsellRate = todayOrders.length > 0 ? (ordersWithUpsell / todayOrders.length) * 100 : 0

            // 2. Chart Data (timezone-aware)
            const chartNodes = Array.from({ length: daysToFetch }, (_, i) => {
                const date = new Date(today)
                date.setDate(date.getDate() - (daysToFetch - 1 - i))
                
                const prevDate = new Date(date)
                prevDate.setDate(prevDate.getDate() - daysToFetch)

                return {
                    name: daysToFetch > 7
                        ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
                        : date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', ''),
                    fullDate: date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
                    prevFullDate: prevDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
                    valor: 0,
                    valorAnterior: 0
                }
            })

            const activeOrders = orders.filter(o => o.status !== 'cancelado')

            activeOrders.forEach(order => {
                const orderDate = new Date(order.criado_em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                const currentDay = chartNodes.find(d => d.fullDate === orderDate)
                if (currentDay) {
                    currentDay.valor += Number(order.valor_total)
                }
                const prevDay = chartNodes.find(d => d.prevFullDate === orderDate)
                if (prevDay) {
                    prevDay.valorAnterior += Number(order.valor_total)
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

                {/* Saídas de hoje elegante */}
                <div className="volume-pills-bar">
                    <span className="volume-bar-title">Saídas de hoje:</span>
                    <div className="volume-pill-item">
                        <span className="vol-name">Espetinhos</span>
                        <strong className="vol-count">{stats.itemCount.espetos}</strong>
                    </div>
                    <div className="volume-pill-item">
                        <span className="vol-name">Açaí Tradicional</span>
                        <strong className="vol-count">{stats.itemCount.acaiTradicional}</strong>
                    </div>
                    <div className="volume-pill-item">
                        <span className="vol-name">Açaí Especial</span>
                        <strong className="vol-count">{stats.itemCount.acaiEspecial}</strong>
                    </div>
                    <div className="volume-pill-item">
                        <span className="vol-name">Refrigerantes</span>
                        <strong className="vol-count">{stats.itemCount.refrigerantes}</strong>
                    </div>
                </div>

                <div className="dashboard-content-grid">
                    <div className="main-stats-column">
                        {/* Chart + Últimos Pedidos lado a lado, mesma altura */}
                        <div className="chart-and-orders-row">
                            {/* Chart Card */}
                            <div className="chart-card-premium chart-flex">
                                <div className="chart-header">
                                    <div className="chart-title-box">
                                        <h3>Vendas ({timeframe === '7' ? '7 dias' : '30 dias'})</h3>
                                        <div className="chart-legend-simple">
                                            <span className="legend-indicator black"></span>
                                            <span>Atual</span>
                                            <span className="legend-indicator gray-dashed"></span>
                                            <span>Período anterior</span>
                                        </div>
                                    </div>
                                    <select
                                        value={timeframe}
                                        onChange={(e) => setTimeframe(e.target.value)}
                                    >
                                        <option value="7">Última semana</option>
                                        <option value="30">Último mês</option>
                                    </select>
                                </div>
                                <div className="chart-container-inner chart-container-flex">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 20 }}>
                                            <defs>
                                                <linearGradient id="colorValorPreto" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#111827" stopOpacity={0.08} />
                                                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                                                </linearGradient>
                                                <pattern id="diagonalHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                                    <line x1="0" y1="0" x2="0" y2="8" stroke="#111827" strokeWidth="1" strokeOpacity="0.08" />
                                                </pattern>
                                            </defs>

                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F1F3" />

                                            <Tooltip
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        const cur = payload.find(p => p.dataKey === 'valor')?.value || 0
                                                        const prev = payload.find(p => p.dataKey === 'valorAnterior')?.value || 0
                                                        return (
                                                            <div className="modern-chart-tooltip">
                                                                <p className="tooltip-date">{label}</p>
                                                                <div className="tooltip-row current">
                                                                    <span className="tooltip-indicator"></span>
                                                                    <span className="tooltip-txt">Atual:</span>
                                                                    <strong className="tooltip-val">{formatCurrency(cur)}</strong>
                                                                </div>
                                                                {prev > 0 && (
                                                                    <div className="tooltip-row prev">
                                                                        <span className="tooltip-indicator dashed"></span>
                                                                        <span className="tooltip-txt">Anterior:</span>
                                                                        <strong className="tooltip-val">{formatCurrency(prev)}</strong>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    }
                                                    return null
                                                }}
                                            />

                                            <Area
                                                type="monotone"
                                                dataKey="valorAnterior"
                                                stroke="#9CA3AF"
                                                strokeWidth={2}
                                                strokeDasharray="4 4"
                                                fill="none"
                                                dot={{ r: 3, fill: '#9CA3AF', strokeWidth: 0 }}
                                                activeDot={{ r: 5, fill: '#9CA3AF' }}
                                            />

                                            <Area
                                                type="monotone"
                                                dataKey="valor"
                                                stroke="#111827"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#diagonalHatch)"
                                                dot={{ r: 3.5, fill: '#111827', strokeWidth: 0 }}
                                                activeDot={{ r: 6, fill: '#111827' }}
                                            />

                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                                dy={12}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                                tickFormatter={(val) => `R$${val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}`}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Últimos Pedidos - ao lado do gráfico, mesma altura */}
                            <div className="recent-orders-card side-compact">
                                <div className="card-header">
                                    <h3>Últimos Pedidos</h3>
                                    <button className="view-all">Ver todos</button>
                                </div>
                                <div className="orders-list">
                                    {recentOrders.map(order => (
                                        <div key={order.id} className="order-row-item">
                                            <div className="order-icon-wrapper">
                                                {order.tipo_pedido === 'entrega' ? <Truck size={16} /> : (order.tipo_pedido === 'retirada' ? <ShoppingBag size={16} /> : <Utensils size={16} />)}
                                            </div>
                                            <div className="order-main-info">
                                                <p className="order-name">
                                                    {order.nome_cliente || 'Cliente'}
                                                </p>
                                                <p className="order-meta">#{order.numero_pedido} • {new Date(order.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <div className="order-right-info">
                                                <span className={`status-tag ${order.status}`}>{order.status === 'saiu_entrega' ? 'saiu' : order.status}</span>
                                                <p className="order-total">{formatCurrency(order.valor_total)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Alertas de Estoque - abaixo dos pedidos */}
                        {lowStockProducts.length > 0 && (
                            <div className="stats-box-card alerts-card full-bottom">
                                <div className="card-header">
                                    <h3>Alertas de Estoque</h3>
                                    <span className="dot animate-pulse"></span>
                                </div>
                                <div className="category-bars alerts-grid-layout">
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
                        {/* Bottom row: Por Categoria + Mais Vendidos */}
                        <div className="bottom-stats-row">
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
                                                <h4>{p.nome}</h4>
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
        </div>
    )
}
