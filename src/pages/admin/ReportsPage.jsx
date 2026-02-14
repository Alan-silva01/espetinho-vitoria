import { useState, useEffect } from 'react'
import {
    BarChart3, TrendingUp, DollarSign,
    Receipt, Stars, ChevronDown, Download,
    PieChart as PieIcon, ArrowUp, Zap
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './ReportsPage.css'

export default function ReportsPage() {
    const [stats, setStats] = useState({
        revenue: 0,
        orders: 0,
        ticket: 0,
        upsell: 0
    })
    const [chartData, setChartData] = useState([])
    const [paymentData, setPaymentData] = useState([])
    const [categoryData, setCategoryData] = useState([])
    const [period, setPeriod] = useState('Este Mês')
    const [loading, setLoading] = useState(true)

    // Advanced Filters State
    const [filterMode, setFilterMode] = useState('quick') // 'quick' or 'advanced'
    const [advancedType, setAdvancedType] = useState('month') // 'day', 'month', 'year'
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    useEffect(() => {
        fetchReportsData()
    }, [period, filterMode, advancedType, selectedDate, selectedMonth, selectedYear])

    async function fetchReportsData() {
        setLoading(true)
        try {
            let startDate = new Date()
            let endDate = new Date()

            if (filterMode === 'quick') {
                if (period === 'Hoje') {
                    startDate.setHours(0, 0, 0, 0)
                } else if (period === 'Ontem') {
                    startDate.setDate(startDate.getDate() - 1)
                    startDate.setHours(0, 0, 0, 0)
                    endDate.setDate(endDate.getDate() - 1)
                    endDate.setHours(23, 59, 59, 999)
                } else if (period === 'Últimos 7 dias') {
                    startDate.setDate(startDate.getDate() - 7)
                    startDate.setHours(0, 0, 0, 0)
                } else { // Este Mês
                    startDate.setDate(1)
                    startDate.setHours(0, 0, 0, 0)
                }
            } else {
                if (advancedType === 'day') {
                    startDate = new Date(selectedDate + 'T00:00:00')
                    endDate = new Date(selectedDate + 'T23:59:59')
                } else if (advancedType === 'month') {
                    startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0)
                    endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59)
                } else { // Year
                    startDate = new Date(selectedYear, 0, 1, 0, 0, 0)
                    endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
                }
            }

            const { data: orders } = await supabase
                .from('pedidos')
                .select(`
                    id, valor_total, forma_pagamento, criado_em,
                    itens:itens_pedido(quantidade, produtos(categorias(nome)))
                `)
                .gte('criado_em', startDate.toISOString())
                .lte('criado_em', endDate.toISOString())

            if (orders) {
                const revenue = orders.reduce((sum, o) => sum + Number(o.valor_total), 0)
                const ticket = orders.length > 0 ? revenue / orders.length : 0

                setStats({
                    revenue,
                    orders: orders.length,
                    ticket,
                    upsell: 12
                })

                // Payment distribution
                const payments = orders.reduce((acc, o) => {
                    const method = o.forma_pagamento?.toUpperCase() || 'OUTROS'
                    acc[method] = (acc[method] || 0) + 1
                    return acc
                }, {})
                setPaymentData(Object.entries(payments).map(([name, count]) => ({
                    name,
                    value: Math.round((count / orders.length) * 100),
                    color: name === 'PIX' ? '#22C55E' : name === 'CREDITO' ? '#3B82F6' : '#9CA3AF'
                })))

                // Category performance
                const cats = {}
                let totalItems = 0
                orders.forEach(o => o.itens?.forEach(i => {
                    const name = i.produtos?.categorias?.nome || 'Outros'
                    cats[name] = (cats[name] || 0) + i.quantidade
                    totalItems += i.quantidade
                }))
                setCategoryData(Object.entries(cats).map(([name, count]) => ({
                    name,
                    percent: Math.round((count / totalItems) * 100),
                    color: name === 'Espetinhos' ? '#C62828' : '#3B82F6'
                })).sort((a, b) => b.percent - a.percent))

                // Chart data - GROUP BY DAY or MONTH
                const dailyData = {}
                const isYearView = filterMode === 'advanced' && advancedType === 'year'

                if (isYearView) {
                    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                    months.forEach(m => dailyData[m] = 0)

                    orders.forEach(o => {
                        const mIdx = new Date(o.criado_em).getMonth()
                        dailyData[months[mIdx]] += Number(o.valor_total)
                    })
                } else {
                    const tempDate = new Date(startDate)
                    while (tempDate <= endDate) {
                        const label = tempDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
                        dailyData[label] = 0
                        tempDate.setDate(tempDate.getDate() + 1)
                        if (Object.keys(dailyData).length > 31) break // Security break
                    }

                    orders.forEach(o => {
                        const label = new Date(o.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
                        if (dailyData[label] !== undefined) {
                            dailyData[label] += Number(o.valor_total)
                        }
                    })
                }

                setChartData(Object.entries(dailyData).map(([name, v]) => ({ name, v })))
            }
        } catch (err) {
            console.error('Reports Error:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="admin-loading">Gerando relatórios...</div>

    return (
        <div className="reports-page-wrapper animate-fade-in">
            <header className="reports-header-premium">
                <div className="header-titles">
                    <h1>Relatórios e Análises</h1>
                    <p>Visão detalhada do desempenho do seu negócio</p>
                </div>
                <div className="header-actions-complex">
                    <div className="filter-mode-tabs">
                        <button
                            className={filterMode === 'quick' ? 'active' : ''}
                            onClick={() => setFilterMode('quick')}
                        >
                            Rápido
                        </button>
                        <button
                            className={filterMode === 'advanced' ? 'active' : ''}
                            onClick={() => setFilterMode('advanced')}
                        >
                            Personalizado
                        </button>
                    </div>

                    {filterMode === 'quick' ? (
                        <div className="period-selector">
                            <select value={period} onChange={e => setPeriod(e.target.value)}>
                                <option>Hoje</option>
                                <option>Ontem</option>
                                <option>Últimos 7 dias</option>
                                <option>Este Mês</option>
                            </select>
                            <ChevronDown size={16} />
                        </div>
                    ) : (
                        <div className="advanced-filter-controls">
                            <select value={advancedType} onChange={e => setAdvancedType(e.target.value)}>
                                <option value="day">Dia</option>
                                <option value="month">Mês</option>
                                <option value="year">Ano</option>
                            </select>

                            {advancedType === 'day' && (
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                />
                            )}

                            {advancedType === 'month' && (
                                <>
                                    <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                                        {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </>
                            )}

                            {advancedType === 'year' && (
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            )}
                        </div>
                    )}

                    <button className="btn-export">
                        <Download size={18} />
                        <span>PDF</span>
                    </button>
                </div>
            </header>

            <div className="reports-grid">
                {/* Stats row */}
                <div className="reports-stats-row">
                    <div className="stat-card accent">
                        <div className="card-top">
                            <div className="icon-box"><DollarSign size={20} /></div>
                            <span className="trend">+15%</span>
                        </div>
                        <div className="card-body">
                            <span>Vendas no Período</span>
                            <h3>{formatCurrency(stats.revenue)}</h3>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="card-top">
                            <div className="icon-box blue"><Receipt size={20} /></div>
                            <span className="trend positive"><ArrowUp size={12} /> 8 novos</span>
                        </div>
                        <div className="card-body">
                            <span>Total de Pedidos</span>
                            <h3>{stats.orders}</h3>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="card-top">
                            <div className="icon-box orange"><Zap size={20} /></div>
                            <span className="trend">Estável</span>
                        </div>
                        <div className="card-body">
                            <span>Ticket Médio</span>
                            <h3>{formatCurrency(stats.ticket)}</h3>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="card-top">
                            <div className="icon-box purple"><Stars size={20} /></div>
                            <div className="mini-chart">
                                <svg viewBox="0 0 36 36" className="circular-chart">
                                    <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="circle" strokeDasharray="60, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                            </div>
                        </div>
                        <div className="card-body">
                            <span>Taxa de Conversão</span>
                            <h3>{stats.upsell}%</h3>
                        </div>
                    </div>
                </div>

                <div className="reports-main-layout">
                    <div className="chart-section-large">
                        <div className="section-header">
                            <h3>Vendas no Período</h3>
                            <div className="legend">
                                <span className="dot" />
                                <span>Faturamento Bruto</span>
                            </div>
                        </div>
                        <div className="main-chart-container">
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#C62828" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#C62828" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />
                                    <Tooltip />
                                    <Area
                                        type="monotone"
                                        dataKey="v"
                                        stroke="#C62828"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorSales)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <aside className="reports-sidebar">
                        <div className="category-performance">
                            <div className="section-header">
                                <h3>Desempenho por Categoria</h3>
                            </div>
                            <div className="performance-list">
                                {categoryData.map(item => (
                                    <div key={item.name} className="perf-item">
                                        <div className="info"><span>{item.name}</span> <strong>{item.percent}%</strong></div>
                                        <div className="bar-bg"><div className="bar-fill" style={{ width: `${item.percent}%`, background: item.color }} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="payment-mix">
                            <div className="section-header">
                                <h3>Métodos de Pagamento</h3>
                            </div>
                            <div className="donut-and-legend">
                                <div className="donut-container">
                                    <ResponsiveContainer width="100%" height={120}>
                                        <PieChart>
                                            <Pie
                                                data={paymentData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={55}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {paymentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="legend-list">
                                    {paymentData.map(item => (
                                        <div key={item.name} className="legend-item">
                                            <span className="dot" style={{ background: item.color }} />
                                            <span>{item.name}</span>
                                            <strong>{item.value}%</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
