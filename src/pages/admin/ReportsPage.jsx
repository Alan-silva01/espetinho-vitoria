import { useState, useEffect, useCallback } from 'react'
import {
    BarChart3, TrendingUp, DollarSign,
    Receipt, Stars, ChevronDown, Download,
    PieChart as PieIcon, ArrowUp, Zap, Filter
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import './ReportsPage.css'

export default function ReportsPage() {
    const [stats, setStats] = useState({
        revenue: 0,
        orders: 0,
        ticket: 0,
        upsell: 0,
        itemCount: {
            espetos: 0,
            acaiTradicional: 0,
            acaiEspecial: 0,
            refrigerantes: 0
        }
    })
    const [chartData, setChartData] = useState([])
    const [paymentData, setPaymentData] = useState([])
    const [categoryData, setCategoryData] = useState([])
    const [period, setPeriod] = useState('Este Mês')
    const [loading, setLoading] = useState(false)

    const getTodaySP = () => {
        try {
            return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
        } catch {
            return new Date().toISOString().split('T')[0]
        }
    }

    const [filterMode, setFilterMode] = useState('quick') // 'quick' or 'advanced'
    const [advancedType, setAdvancedType] = useState('month') // 'day', 'month', 'year', 'period'
    const [selectedDate, setSelectedDate] = useState(getTodaySP)
    const [selectedStartDate, setSelectedStartDate] = useState(getTodaySP)
    const [selectedEndDate, setSelectedEndDate] = useState(getTodaySP)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    // Initial load & automatic fetch when quick preset changes
    useEffect(() => {
        fetchReportsData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, filterMode])

    // Wake-from-sleep: re-fetch reports data silently
    useVisibilityRefresh(useCallback(() => {
        console.log('[ReportsPage] Woke from sleep — refreshing silently')
        fetchReportsData(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, filterMode, advancedType, selectedDate, selectedMonth, selectedYear, selectedStartDate, selectedEndDate]))

    async function fetchReportsData(isSilent = false) {
        if (!isSilent) setLoading(true)
        try {
            // Use São Paulo timezone for all date boundaries
            const spNow = new Date()
            const spDateStr = spNow.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // 'YYYY-MM-DD'
            const today = new Date(spDateStr + 'T00:00:00-03:00') // Midnight in SP (UTC-3)

            let startDate = new Date(today)
            let endDate = new Date(spDateStr + 'T23:59:59-03:00')

            const parseDateInput = (str) => {
                if (!str) return spDateStr
                let y, m, d
                if (str.includes('-')) {
                    const parts = str.split('-')
                    if (parts[0].length === 4) {
                        y = parseInt(parts[0], 10)
                        m = parseInt(parts[1], 10)
                        d = parseInt(parts[2], 10)
                    } else {
                        d = parseInt(parts[0], 10)
                        m = parseInt(parts[1], 10)
                        y = parseInt(parts[2], 10)
                    }
                } else if (str.includes('/')) {
                    const parts = str.split('/')
                    if (parts[2]?.length === 4) {
                        d = parseInt(parts[0], 10)
                        m = parseInt(parts[1], 10)
                        y = parseInt(parts[2], 10)
                    } else if (parts[0]?.length === 4) {
                        y = parseInt(parts[0], 10)
                        m = parseInt(parts[1], 10)
                        d = parseInt(parts[2], 10)
                    }
                }

                if (y && m && d && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
                    if (y < 2000) y = spNow.getFullYear()
                    const yyyy = y.toString().padStart(4, '0')
                    const mm = m.toString().padStart(2, '0')
                    const dd = d.toString().padStart(2, '0')
                    return `${yyyy}-${mm}-${dd}`
                }

                return spDateStr
            }

            if (filterMode === 'quick') {
                if (period === 'Hoje') {
                    // Already set to today 00h - 23h59
                } else if (period === 'Ontem') {
                    startDate.setDate(startDate.getDate() - 1)
                    endDate = new Date(startDate)
                    endDate.setHours(23, 59, 59, 999)
                } else if (period === 'Últimos 7 dias') {
                    startDate.setDate(startDate.getDate() - 7)
                } else if (period === 'Este Mês') {
                    startDate.setDate(1)
                } else if (period === 'Mês Passado') {
                    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0)
                    endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59)
                } else if (period === 'Este Ano') {
                    startDate = new Date(today.getFullYear(), 0, 1, 0, 0, 0)
                } else if (period === 'Todo o Período') {
                    startDate = new Date('2023-01-01T00:00:00-03:00')
                }
            } else {
                if (advancedType === 'day') {
                    const cleanDate = parseDateInput(selectedDate)
                    startDate = new Date(cleanDate + 'T00:00:00-03:00')
                    endDate = new Date(cleanDate + 'T23:59:59-03:00')
                } else if (advancedType === 'month') {
                    startDate = new Date(selectedYear, selectedMonth, 1, 0, 0, 0)
                    endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59)
                } else if (advancedType === 'year') {
                    startDate = new Date(selectedYear, 0, 1, 0, 0, 0)
                    endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
                } else if (advancedType === 'period') {
                    const s = parseDateInput(selectedStartDate)
                    const e = parseDateInput(selectedEndDate)
                    startDate = new Date(s + 'T00:00:00-03:00')
                    endDate = new Date(e + 'T23:59:59-03:00')
                    
                    if (startDate > endDate) {
                        startDate = new Date(e + 'T00:00:00-03:00')
                        endDate = new Date(s + 'T23:59:59-03:00')
                    }
                }
            }

            // Calcular período anterior para comparação
            const durationMs = endDate.getTime() - startDate.getTime()
            const prevStartDate = new Date(startDate.getTime() - durationMs)
            const prevEndDate = new Date(startDate.getTime() - 1)

            // Fetch all orders with automatic pagination to bypass Supabase 1000-row limit (incluindo prevStartDate)
            let orders = []
            let page = 0
            const pageSize = 1000
            let hasMore = true

            while (hasMore) {
                const from = page * pageSize
                const to = from + pageSize - 1

                const { data, error } = await supabase
                    .from('pedidos')
                    .select(`
                        id, valor_total, forma_pagamento, criado_em, status,
                        itens:itens_pedido(
                            quantidade,
                            eh_upsell, 
                            produtos(nome, categorias(nome))
                        )
                    `)
                    .gte('criado_em', prevStartDate.toISOString())
                    .lte('criado_em', endDate.toISOString())
                    .order('criado_em', { ascending: true })
                    .range(from, to)

                if (error) {
                    console.error('[fetchReportsData] Erro ao buscar pagina de pedidos:', error)
                    break
                }

                if (data && data.length > 0) {
                    orders = orders.concat(data)
                    if (data.length < pageSize) {
                        hasMore = false
                    } else {
                        page++
                    }
                } else {
                    hasMore = false
                }

                if (page > 50) break // Safety cap (max 50,000 orders)
            }

            if (orders) {
                // Exclude cancelled orders
                const allValidOrders = orders.filter(o => o.status !== 'cancelado')
                // Valid orders for the SELECTED period only
                const validOrders = allValidOrders.filter(o => {
                    const d = new Date(o.criado_em)
                    return d >= startDate && d <= endDate
                })
                const revenue = validOrders.reduce((sum, o) => sum + Number(o.valor_total), 0)
                const ticket = validOrders.length > 0 ? revenue / validOrders.length : 0

                // Volumetric Counts for the selected period
                const periodCounts = {
                    espetos: 0,
                    acaiTradicional: 0,
                    acaiEspecial: 0,
                    refrigerantes: 0
                }

                validOrders.forEach(order => {
                    order.itens?.forEach(item => {
                        const prodName = item.produtos?.nome || ''
                        const catName = item.produtos?.categorias?.nome || ''
                        const qty = item.quantidade || 0

                        if (catName === 'Espetinhos') {
                            periodCounts.espetos += qty
                        } else if (prodName === 'Açaí Tradicional') {
                            periodCounts.acaiTradicional += qty
                        } else if (prodName === 'Açaí Especial') {
                            periodCounts.acaiEspecial += qty
                        } else if (prodName.toLowerCase().startsWith('refrigerante')) {
                            periodCounts.refrigerantes += qty
                        }
                    })
                })

                const ordersWithUpsell = validOrders.filter(o => o.itens?.some(i => i.eh_upsell)).length
                const upsellRate = validOrders.length > 0 ? (ordersWithUpsell / validOrders.length) * 100 : 0

                setStats({
                    revenue,
                    orders: validOrders.length,
                    ticket,
                    upsell: Number(upsellRate.toFixed(1)),
                    itemCount: periodCounts
                })

                // Payment distribution
                const payments = validOrders.reduce((acc, o) => {
                    let method = o.forma_pagamento?.toLowerCase() || 'outros'
                    if (method === 'cartao_credito') method = 'CRÉDITO'
                    else if (method === 'cartao_debito') method = 'DÉBITO'
                    else if (method === 'cartao_entrega' || method.includes('cartao')) method = 'CARTÃO'
                    else if (method === 'pix') method = 'PIX'
                    else if (method === 'dinheiro') method = 'DINHEIRO'
                    else method = method.toUpperCase()
                    acc[method] = (acc[method] || 0) + 1
                    return acc
                }, {})
                setPaymentData(Object.entries(payments).map(([name, count]) => ({
                    name,
                    value: Math.round((count / validOrders.length) * 100),
                    color: name === 'PIX' ? '#232220' : name === 'CRÉDITO' ? '#4B5563' : name === 'DÉBITO' ? '#6B7280' : name === 'DINHEIRO' ? '#9CA3AF' : '#D1D5DB'
                })))

                // Category performance
                const cats = {}
                let totalItems = 0
                validOrders.forEach(o => o.itens?.forEach(i => {
                    const name = i.produtos?.categorias?.nome || 'Outros'
                    cats[name] = (cats[name] || 0) + i.quantidade
                    totalItems += i.quantidade
                }))
                setCategoryData(Object.entries(cats).map(([name, count]) => ({
                    name,
                    percent: Math.round((count / totalItems) * 100),
                    color: name === 'Espetinhos' ? '#232220' : name === 'Açaí' ? '#4B5563' : name === 'Caldos' ? '#6B7280' : '#9CA3AF'
                })).sort((a, b) => b.percent - a.percent))

                // Chart data - GROUP BY DAY or MONTH with SP Timezone and comparison with previous period
                const chartPoints = []
                
                let chartStartDate = new Date(startDate)
                if (validOrders.length > 0) {
                    const minOrderTime = Math.min(...validOrders.map(o => new Date(o.criado_em).getTime()))
                    const minOrderDate = new Date(minOrderTime)
                    if (chartStartDate < minOrderDate || period === 'Todo o Período') {
                        chartStartDate = minOrderDate
                    }
                }

                const diffTime = Math.abs(endDate - chartStartDate)
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                const isMonthView = diffDays > 31

                if (isMonthView) {
                    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                    const getMonthLabel = (dObj) => {
                        const dateStr = dObj.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                        const [y, m] = dateStr.split('-')
                        return `${months[parseInt(m, 10) - 1]}/${y.slice(-2)}`
                    }

                    const tempDate = new Date(chartStartDate.getFullYear(), chartStartDate.getMonth(), 1, 0, 0, 0)
                    const endMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1, 0, 0, 0)

                    while (tempDate <= endMonthDate) {
                        const curYear = tempDate.getFullYear()
                        const curMonth = tempDate.getMonth()
                        const label = getMonthLabel(tempDate)
                        
                        // Período anterior equivalente (1 ano antes para visão mensal)
                        const prevYear = curYear - 1

                        chartPoints.push({
                            name: label,
                            curYear,
                            curMonth,
                            prevYear,
                            v: 0,
                            vAnterior: 0
                        })

                        tempDate.setMonth(tempDate.getMonth() + 1)
                        if (chartPoints.length > 60) break
                    }

                    allValidOrders.forEach(o => {
                        const d = new Date(o.criado_em)
                        const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                        const [y, m] = dateStr.split('-').map(Number)
                        const val = Number(o.valor_total || 0)

                        const ptCur = chartPoints.find(p => p.curYear === y && p.curMonth === (m - 1))
                        if (ptCur) ptCur.v += val

                        const ptPrev = chartPoints.find(p => p.prevYear === y && p.curMonth === (m - 1))
                        if (ptPrev) ptPrev.vAnterior += val
                    })
                } else {
                    const getDayLabel = (dObj) => {
                        return dObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' }).replace('.', '')
                    }
                    const getDateKey = (dObj) => {
                        return dObj.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                    }

                    const totalDays = Math.max(1, Math.round((endDate.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24)))
                    const tempDate = new Date(chartStartDate)

                    while (tempDate <= endDate) {
                        const label = getDayLabel(tempDate)
                        const curKey = getDateKey(tempDate)

                        const prevDate = new Date(tempDate)
                        prevDate.setDate(prevDate.getDate() - totalDays)
                        const prevKey = getDateKey(prevDate)

                        chartPoints.push({
                            name: label,
                            curKey,
                            prevKey,
                            v: 0,
                            vAnterior: 0
                        })

                        tempDate.setDate(tempDate.getDate() + 1)
                        if (chartPoints.length > 60) break
                    }

                    allValidOrders.forEach(o => {
                        const d = new Date(o.criado_em)
                        const orderKey = getDateKey(d)
                        const val = Number(o.valor_total || 0)

                        const curNode = chartPoints.find(p => p.curKey === orderKey)
                        if (curNode) curNode.v += val

                        const prevNode = chartPoints.find(p => p.prevKey === orderKey)
                        if (prevNode) prevNode.vAnterior += val
                    })
                }

                setChartData(chartPoints)


            }
        } catch (err) {
            console.error('Reports Error:', err)
        } finally {
            setLoading(false)
        }
    }

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
                                <option>Mês Passado</option>
                                <option>Este Ano</option>
                                <option>Todo o Período</option>
                            </select>
                            <ChevronDown size={16} />
                        </div>
                    ) : (
                        <div className="advanced-filter-controls">
                            <select value={advancedType} onChange={e => setAdvancedType(e.target.value)}>
                                <option value="day">Dia</option>
                                <option value="month">Mês</option>
                                <option value="year">Ano</option>
                                <option value="period">Período (De/Até)</option>
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

                            {advancedType === 'period' && (
                                <div className="date-range-inputs">
                                    <input
                                        type="date"
                                        value={selectedStartDate}
                                        onChange={e => setSelectedStartDate(e.target.value)}
                                        title="Data Inicial"
                                    />
                                    <span>até</span>
                                    <input
                                        type="date"
                                        value={selectedEndDate}
                                        onChange={e => setSelectedEndDate(e.target.value)}
                                        title="Data Final"
                                    />
                                </div>
                            )}

                            <button
                                className="btn-apply-filter"
                                onClick={() => fetchReportsData()}
                                disabled={loading}
                                title="Buscar no período selecionado"
                            >
                                <Filter size={14} />
                                <span>{loading ? 'Buscando...' : 'Filtrar'}</span>
                            </button>
                        </div>
                    )}

                    <button className="btn-export" onClick={() => window.print()}>
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
                            <span>Taxa de Upsell</span>
                            <h3>{stats.upsell}%</h3>
                        </div>
                    </div>
                </div>

                {/* Sub-header for volumetric items */}
                <div className="section-divider">
                    <h3>Volume de Vendas (Quantidade)</h3>
                    <div className="line" />
                </div>

                <div className="reports-stats-row volumetric">
                    <div className="stat-item-card mini red">
                        <div className="item-label">Espetinhos</div>
                        <div className="item-value">{stats.itemCount.espetos}</div>
                        <div className="item-unit">unidades</div>
                    </div>
                    <div className="stat-item-card mini purple">
                        <div className="item-label">Açaí Tradicional</div>
                        <div className="item-value">{stats.itemCount.acaiTradicional}</div>
                        <div className="item-unit">unidades</div>
                    </div>
                    <div className="stat-item-card mini purple-light">
                        <div className="item-label">Açaí Especial</div>
                        <div className="item-value">{stats.itemCount.acaiEspecial}</div>
                        <div className="item-unit">unidades</div>
                    </div>
                    <div className="stat-item-card mini blue">
                        <div className="item-label">Refrigerantes</div>
                        <div className="item-value">{stats.itemCount.refrigerantes}</div>
                        <div className="item-unit">unidades</div>
                    </div>
                </div>

                <div className="reports-main-layout">
                    <div className="chart-section-large">
                        <div className="section-header">
                            <div className="chart-title-box">
                                <h3>Vendas no Período</h3>
                                <div className="chart-legend-simple">
                                    <span className="legend-indicator black"></span>
                                    <span>Atual</span>
                                    <span className="legend-indicator gray-dashed"></span>
                                    <span>Período anterior</span>
                                </div>
                            </div>
                        </div>
                        <div className="main-chart-container">
                            <ResponsiveContainer width="100%" height={320}>
                                <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 20 }}>
                                    <defs>
                                        <pattern id="diagonalHatchReports" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                            <line x1="0" y1="0" x2="0" y2="8" stroke="#111827" strokeWidth="1" strokeOpacity="0.08" />
                                        </pattern>
                                    </defs>

                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F1F3" />

                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                                        tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                                        dx={-5}
                                    />

                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const cur = payload.find(p => p.dataKey === 'v')?.value || 0
                                                const prev = payload.find(p => p.dataKey === 'vAnterior')?.value || 0
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
                                        dataKey="vAnterior"
                                        stroke="#9CA3AF"
                                        strokeWidth={2}
                                        strokeDasharray="4 4"
                                        fill="none"
                                        dot={{ r: 3, fill: '#9CA3AF', strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: '#9CA3AF' }}
                                    />

                                    <Area
                                        type="monotone"
                                        dataKey="v"
                                        stroke="#111827"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#diagonalHatchReports)"
                                        dot={{ r: 3.5, fill: '#111827', strokeWidth: 0 }}
                                        activeDot={{ r: 6, fill: '#111827' }}
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
                                <div className="donut-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <PieChart width={120} height={120}>
                                        <Pie
                                            data={paymentData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={36}
                                            outerRadius={48}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {paymentData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
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
