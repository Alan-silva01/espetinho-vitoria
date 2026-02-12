import { useState, useEffect } from 'react'
import {
    Truck, Users, Clock, TrendingUp,
    Search, Filter, Plus, Phone,
    Bike, MapPin, MoreHorizontal,
    ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './DriversPage.css'

export default function DriversPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [drivers, setDrivers] = useState([
        { id: 1, nome: 'João Silva', status: 'Disponível', entregas: 24, total: 380, tel: '(11) 98765-4321', avatar: 'https://via.placeholder.com/64' },
        { id: 2, nome: 'Carlos Pereira', status: 'Em Entrega', entregas: 18, total: 295, tel: '(11) 99887-1122', avatar: 'https://via.placeholder.com/64' },
        { id: 3, nome: 'Ana Souza', status: 'Disponível', entregas: 15, total: 210, tel: '(11) 91234-5678', avatar: 'https://via.placeholder.com/64' },
        { id: 4, nome: 'Marcos Dias', status: 'Offline', entregas: 5, total: 80, tel: '(11) 94455-6677', avatar: 'https://via.placeholder.com/64' }
    ])

    const distributionData = [
        { name: 'Zona Norte', value: 35, color: '#C81E1E' },
        { name: 'Centro', value: 25, color: '#F8B4B4' },
        { name: 'Outros', value: 40, color: '#E5E7EB' },
    ]

    return (
        <div className="drivers-page-wrapper animate-fade-in">
            <header className="drivers-header-premium">
                <div className="header-titles">
                    <h1>Gestão de Entregas</h1>
                    <p>Acompanhe a performance da sua equipe de motoboys em tempo real.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-add-driver">
                        <Plus size={18} />
                        <span>Novo Entregador</span>
                    </button>
                </div>
            </header>

            <div className="drivers-stats-row">
                <div className="driver-stat-card">
                    <div className="stat-content">
                        <span>Entregas Hoje</span>
                        <h3>142</h3>
                        <p className="trend-up"><TrendingUp size={12} /> +12.5% vs ontem</p>
                    </div>
                    <div className="stat-icon blue"><Bike /></div>
                </div>
                <div className="driver-stat-card">
                    <div className="stat-content">
                        <span>Entregadores Ativos</span>
                        <h3>8</h3>
                        <p className="meta">De um total de 12 cadastrados</p>
                    </div>
                    <div className="stat-icon green"><Users /></div>
                </div>
                <div className="driver-stat-card">
                    <div className="stat-content">
                        <span>Tempo Médio</span>
                        <h3>28 min</h3>
                        <p className="trend-down"><TrendingUp size={12} /> -2 min vs ontem</p>
                    </div>
                    <div className="stat-icon orange"><Clock /></div>
                </div>
            </div>

            <div className="drivers-main-layout">
                <div className="drivers-list-section">
                    <div className="section-header-row">
                        <h3>Equipe de Entregas</h3>
                        <div className="header-tools">
                            <div className="search-box-small">
                                <Search size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar entregador..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button className="icon-btn-border"><Filter size={18} /></button>
                        </div>
                    </div>

                    <div className="drivers-cards-stack">
                        {drivers.map(driver => (
                            <div key={driver.id} className={`driver-card-v2 ${driver.status === 'Offline' ? 'offline' : ''}`}>
                                <div className="driver-avatar-box">
                                    <img src={driver.avatar} alt={driver.nome} />
                                    <span className={`status-dot ${driver.status.toLowerCase().replace(' ', '-')}`} />
                                </div>
                                <div className="driver-info-main">
                                    <div className="top-line">
                                        <h4>{driver.nome}</h4>
                                        <span className={`status-tag-v2 ${driver.status.toLowerCase().replace(' ', '-')}`}>
                                            {driver.status}
                                        </span>
                                    </div>
                                    <p className="driver-tel"><Phone size={12} /> {driver.tel}</p>
                                </div>
                                <div className="driver-stats-box">
                                    <div className="stat-group">
                                        <strong>{driver.entregas}</strong>
                                        <span>Entregas</span>
                                    </div>
                                    <div className="stat-group">
                                        <strong>{formatCurrency(driver.total)}</strong>
                                        <span>Total</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <aside className="drivers-sidebar">
                    <div className="distribution-card">
                        <h3>Distribuição de Entregas</h3>
                        <div className="donut-chart-container">
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="donut-center">
                                <strong>142</strong>
                                <span>Total</span>
                            </div>
                        </div>
                        <div className="dist-legend">
                            {distributionData.map(item => (
                                <div key={item.name} className="legend-item">
                                    <span className="dot" style={{ background: item.color }} />
                                    <span>{item.name}</span>
                                    <strong>{item.value}%</strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pending-deliveries-card">
                        <div className="card-header">
                            <h3>Entregas Pendentes</h3>
                            <button className="link-btn">Ver todas</button>
                        </div>
                        <div className="pending-list">
                            <div className="pending-row">
                                <div className="order-num">#42</div>
                                <div className="order-info">
                                    <strong>Espetinho Picanha x5</strong>
                                    <p>Rua das Flores, 123</p>
                                </div>
                                <span className="status waiting">Aguardando</span>
                            </div>
                            <div className="pending-row">
                                <div className="order-num blue">#43</div>
                                <div className="order-info">
                                    <strong>Combo Família</strong>
                                    <p>Av. Paulista, 1000</p>
                                </div>
                                <span className="status kitchen">Cozinha</span>
                            </div>
                        </div>
                        <button className="btn-assign">Atribuir Entregador</button>
                    </div>
                </aside>
            </div>
        </div>
    )
}
