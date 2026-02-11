import { useState, useEffect } from 'react'
import {
    DollarSign, ShoppingBag, Users, Heart,
    TrendingUp, ArrowUpRight, ArrowDownRight,
    Flame, Award, Clock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './DashboardPage.css'

export default function DashboardPage() {
    const [stats, setStats] = useState({
        revenue: 0,
        orders: 0,
        customers: 0,
        likes: 0
    })
    const [topProducts, setTopProducts] = useState([])
    const [recentOrders, setRecentOrders] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDashboardData()
    }, [])

    async function fetchDashboardData() {
        setLoading(true)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        try {
            // 1. Stats and Metrics
            const { data: ordersToday } = await supabase
                .from('pedidos')
                .select('valor_total')
                .gte('criado_em', today.toISOString())

            const { count: totalCustomers } = await supabase
                .from('clientes')
                .select('*', { count: 'exact', head: true })

            const { count: totalLikes } = await supabase
                .from('curtidas')
                .select('*', { count: 'exact', head: true })

            const revenueToday = ordersToday?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0

            setStats({
                revenue: revenueToday,
                orders: ordersToday?.length || 0,
                customers: totalCustomers || 0,
                likes: totalLikes || 0
            })

            // 2. Top Products (Most Liked)
            const { data: popularLikes } = await supabase
                .from('curtidas')
                .select('produto_id, produtos(nome, imagem_url)')

            // Client-side grouping for simplicity in this MVP
            const likesCount = {}
            popularLikes?.forEach(l => {
                const id = l.produto_id
                if (!likesCount[id]) {
                    likesCount[id] = {
                        id,
                        nome: l.produtos?.nome,
                        imagem: l.produtos?.imagem_url,
                        count: 0
                    }
                }
                likesCount[id].count++
            })

            const sortedLikes = Object.values(likesCount)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)

            setTopProducts(sortedLikes)

            // 3. Recent Orders
            const { data: recent } = await supabase
                .from('pedidos')
                .select('*')
                .order('criado_em', { ascending: false })
                .limit(5)

            setRecentOrders(recent || [])

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="admin-loading">Carregando métricas...</div>

    return (
        <div className="dashboard-content animate-fade-in">
            <header className="dashboard-header">
                <div>
                    <h1>Olá, Admin 👋</h1>
                    <p>Aqui está o resumo de hoje para o Espetinho Vitória.</p>
                </div>
                <div className="dashboard-date">
                    <Clock size={16} />
                    <span>{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</span>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-card__info">
                        <p className="stat-card__label">Vendas Hoje</p>
                        <h3 className="stat-card__value">{formatCurrency(stats.revenue)}</h3>
                        <div className="stat-card__trend positive">
                            <TrendingUp size={12} />
                            <span>+12.5%</span>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
                        <ShoppingBag size={24} />
                    </div>
                    <div className="stat-card__info">
                        <p className="stat-card__label">Pedidos Hoje</p>
                        <h3 className="stat-card__value">{stats.orders}</h3>
                        <p className="stat-card__subtext">Aguardando preparo</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                        <Users size={24} />
                    </div>
                    <div className="stat-card__info">
                        <p className="stat-card__label">Clientes</p>
                        <h3 className="stat-card__value">{stats.customers}</h3>
                        <p className="stat-card__subtext">Base total</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                        <Heart size={24} />
                    </div>
                    <div className="stat-card__info">
                        <p className="stat-card__label">Curtidas</p>
                        <h3 className="stat-card__value">{stats.likes}</h3>
                        <p className="stat-card__subtext">Interações totais</p>
                    </div>
                </div>
            </div>

            <div className="dashboard-main-grid">
                {/* Popular Products */}
                <section className="dashboard-section popular-products">
                    <div className="section-header">
                        <h2><Award size={20} /> Os Queridinhos</h2>
                        <button className="section-link">Ver todos</button>
                    </div>
                    <div className="popular-list">
                        {topProducts.map((p, index) => (
                            <div key={p.id} className="popular-item">
                                <div className="popular-item__rank">{index + 1}</div>
                                <div className="popular-item__img">
                                    <img src={p.imagem || 'https://via.placeholder.com/50'} alt={p.nome} />
                                </div>
                                <div className="popular-item__info">
                                    <p className="popular-item__name">{p.nome}</p>
                                    <div className="popular-item__likes">
                                        <Heart size={12} fill="#EF4444" color="#EF4444" />
                                        <span>{p.count} curtidas</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {topProducts.length === 0 && <p className="empty-msg">Nenhuma curtida ainda.</p>}
                    </div>
                </section>

                {/* Recent Activity */}
                <section className="dashboard-section recent-activity">
                    <div className="section-header">
                        <h2><Flame size={20} /> Pedidos Recentes</h2>
                        <button className="section-link" onClick={() => window.location.href = '/admin/pedidos'}>Gerenciar</button>
                    </div>
                    <div className="activity-list">
                        {recentOrders.map(order => (
                            <div key={order.id} className="activity-item">
                                <div className={`activity-status-dot ${order.status}`} />
                                <div className="activity-item__info">
                                    <p className="activity-item__title">
                                        <strong>#{order.numero_pedido}</strong> - {order.nome_cliente}
                                    </p>
                                    <p className="activity-item__time">
                                        {new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {formatCurrency(order.valor_total)}
                                    </p>
                                </div>
                                <span className={`status-badge ${order.status}`}>
                                    {order.status}
                                </span>
                            </div>
                        ))}
                        {recentOrders.length === 0 && <p className="empty-msg">Nenhum pedido recente.</p>}
                    </div>
                </section>
            </div>
        </div>
    )
}
