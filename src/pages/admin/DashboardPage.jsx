import { useState, useEffect } from 'react'
import {
    DollarSign, ShoppingBag, Users, Heart,
    TrendingUp, ArrowUpRight, ArrowDownRight,
    Flame, Award, Clock, Receipt, Stars, Calendar,
    BarChart3, ChevronRight, MoreHorizontal,
    Utensils, Truck, Check, Share2, Search, Bell
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './DashboardPage.css'

export default function DashboardPage() {
    const [stats, setStats] = useState({
        revenue: 0,
        orders: 0,
        ticket: 0,
        upsell: 0
    })
    const [topProducts, setTopProducts] = useState([])
    const [recentOrders, setRecentOrders] = useState([])
    const [categorySales, setCategorySales] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDashboardData()
    }, [])

    async function fetchDashboardData() {
        setLoading(true)
        console.log('[Dashboard] Iniciando carregamento de métricas...')

        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // 1. Stats and Metrics
            try {
                const { data: ordersToday, error: ordersErr } = await supabase
                    .from('pedidos')
                    .select('valor_total, status')
                    .gte('criado_em', today.toISOString())

                if (ordersErr) throw ordersErr

                const totalRevenue = ordersToday?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0
                const totalOrders = ordersToday?.length || 0
                const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

                setStats(prev => ({
                    ...prev,
                    revenue: totalRevenue,
                    orders: totalOrders,
                    ticket: avgTicket
                }))
            } catch (err) {
                console.warn('[Dashboard] Erro ao buscar pedidos hoje:', err.message)
            }

            // 2. Top Products
            try {
                const { data: popular, error: prodErr } = await supabase
                    .from('produtos')
                    .select('id, nome, imagem_url, categorias(nome)')
                    .limit(5)

                if (prodErr) throw prodErr
                setTopProducts(popular || [])
            } catch (err) {
                console.warn('[Dashboard] Erro ao buscar produtos populares:', err.message)
            }

            // 3. Recent Orders
            try {
                const { data: recent, error: recentErr } = await supabase
                    .from('pedidos')
                    .select('*')
                    .order('criado_em', { ascending: false })
                    .limit(4)

                if (recentErr) throw recentErr
                setRecentOrders(recent || [])
            } catch (err) {
                console.warn('[Dashboard] Erro ao buscar pedidos recentes:', err.message)
            }

            // 4. Category Sales (Static for now)
            setCategorySales([
                { name: 'Espetinhos', percent: 65, color: '#B91C1C' },
                { name: 'Bebidas', percent: 25, color: '#3B82F6' },
                { name: 'Acompanhamentos', percent: 10, color: '#F59E0B' }
            ])

        } catch (error) {
            console.error('[Dashboard] Erro crítico no carregamento:', error)
        } finally {
            console.log('[Dashboard] Carregamento finalizado.')
            setLoading(false)
        }
    }

    // Chart Data (Mocked for 7 days)
    const chartData = [
        { name: 'Seg', uv: 2400 },
        { name: 'Ter', uv: 1398 },
        { name: 'Qua', uv: 9800 },
        { name: 'Qui', uv: 3908 },
        { name: 'Sex', uv: 4800 },
        { name: 'Sáb', uv: 3800 },
        { name: 'Dom', uv: 4300 },
    ]

    if (loading) return <div className="admin-loading">Carregando métricas...</div>

    return (
        <div className="dashboard-wrapper animate-fade-in">
            <header className="dashboard-header-premium">
                <div className="header-titles">
                    <h1>Visão Geral</h1>
                    <p>Olá, Admin 👋 Aqui está o resumo de hoje.</p>
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
                                <span className="trend-badge">
                                    <TrendingUp size={12} /> +15%
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
                                <span className="trend-positive">8 novos</span>
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
                                    <path className="progress-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ strokeDasharray: '75, 100' }} />
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

                <div className="dashboard-content-grid">
                    <div className="main-stats-column">
                        {/* Chart Card */}
                        <div className="chart-card-premium">
                            <div className="chart-header">
                                <h3>Vendas (7 dias)</h3>
                                <select>
                                    <option>Última semana</option>
                                    <option>Último mês</option>
                                </select>
                            </div>
                            <div className="chart-container-inner">
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#B91C1C" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#B91C1C" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            cursor={{ stroke: '#B91C1C', strokeWidth: 2, strokeDasharray: '5 5' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="uv"
                                            stroke="#B91C1C"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorUv)"
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
                                            {order.tipo_pedido === 'entrega' ? <Truck size={18} /> : <Utensils size={18} />}
                                        </div>
                                        <div className="order-main-info">
                                            <p className="order-name">{order.tipo_pedido === 'entrega' ? `Delivery (${order.nome_cliente})` : `Mesa/Balcão (${order.nome_cliente})`}</p>
                                            <p className="order-meta">#PED-{order.numero_pedido} • {new Date(order.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="order-right-info">
                                            <span className={`status-tag ${order.status}`}>{order.status}</span>
                                            <p className="order-total">{formatCurrency(order.valor_total)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-stats-column">
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
                                            <p>{p.categorias?.nome}</p>
                                        </div>
                                        <div className="product-sales">
                                            <span className="sales-num">120</span>
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
