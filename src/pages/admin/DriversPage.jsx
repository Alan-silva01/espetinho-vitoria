import { useState, useEffect } from 'react'
import {
    Truck, Users, Clock, TrendingUp,
    Search, Filter, Plus, Phone,
    Bike, MapPin, MoreHorizontal,
    ChevronRight, AlertCircle, CheckCircle2, Trash2
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './DriversPage.css'

export default function DriversPage() {
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(true)
    const [pendingOrders, setPendingOrders] = useState([])
    const [stats, setStats] = useState({
        todayDeliveries: 0,
        activeDrivers: 0,
        avgTime: 0
    })
    const [searchTerm, setSearchTerm] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, nome: '' })
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [newDriver, setNewDriver] = useState({ nome: '', telefone: '' })
    const [saving, setSaving] = useState(false)

    // Helper: 11 digits (99991372552) -> 559991372552@s.whatsapp.net (removed index 3 extra 9)
    const formatPhoneForDB = (val) => {
        const digits = val.replace(/\D/g, '')
        if (digits.length !== 11) return digits // fallback
        const ddd = digits.substring(0, 2)
        const rest = digits.substring(3) // skip index 2 (the 3rd digit)
        return `55${ddd}${rest}@s.whatsapp.net`
    }

    // Helper: 559991372552@s.whatsapp.net -> (99) 9137-2552
    const formatPhoneDisplay = (dbVal) => {
        if (!dbVal) return ''
        const clean = dbVal.split('@')[0].replace('55', '')
        const ddd = clean.substring(0, 2)
        const part1 = clean.substring(2, 6)
        const part2 = clean.substring(6)
        return `(${ddd}) ${part1}-${part2}`
    }

    useEffect(() => {
        fetchDriversData()
    }, [])

    async function fetchDriversData() {
        setLoading(true)
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // 1. Fetch Drivers
            const { data: driversData } = await supabase
                .from('entregadores')
                .select('*')
                .order('nome')

            // 2. Fetch Orders (Deliveries) to calculate performance
            const { data: deliveries } = await supabase
                .from('pedidos')
                .select('id, entregador_id, valor_total, status, tipo_pedido, criado_em')
                .eq('tipo_pedido', 'entrega')
                .gte('criado_em', today.toISOString())

            // 3. Fetch Pending Deliveries
            const { data: pending } = await supabase
                .from('pedidos')
                .select('*')
                .eq('tipo_pedido', 'entrega')
                .in('status', ['confirmado', 'preparando', 'entrega'])
                .limit(5)

            if (driversData) {
                const enriched = driversData.map(d => {
                    const dDeliveries = deliveries?.filter(o => o.entregador_id === d.id) || []
                    return {
                        id: d.id,
                        nome: d.nome,
                        status: d.ativo ? 'Disponível' : 'Offline',
                        entregas: dDeliveries.length,
                        total: dDeliveries.reduce((sum, o) => sum + Number(o.valor_total), 0),
                        tel: d.telefone,
                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.nome)}&background=random`
                    }
                })
                setDrivers(enriched)
                setStats({
                    todayDeliveries: deliveries?.length || 0,
                    activeDrivers: driversData.filter(d => d.ativo).length,
                    avgTime: 28 // Keep mock for now as time calculation is complex
                })
            }
            setPendingOrders(pending || [])
        } catch (err) {
            console.error('Erro Drivers:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveDriver() {
        if (!newDriver.nome || !newDriver.telefone) {
            alert('Por favor, preencha nome e telefone.')
            return
        }

        const phoneDigits = newDriver.telefone.replace(/\D/g, '')
        if (phoneDigits.length !== 11) {
            alert('O telefone deve ter 11 dígitos (DDD + número com o 9 extra).')
            return
        }

        setSaving(true)
        const dbPhone = formatPhoneForDB(phoneDigits)

        const { data, error } = await supabase
            .from('entregadores')
            .insert({
                nome: newDriver.nome,
                telefone: dbPhone,
                ativo: true
            })
            .select()

        if (!error) {
            await fetchDriversData()
            setIsAddOpen(false)
            setNewDriver({ nome: '', telefone: '' })
        } else {
            alert('Erro ao salvar entregador: ' + error.message)
        }
        setSaving(false)
    }

    async function handleDeleteClick(driver) {
        setDeleteConfirm({ open: true, id: driver.id, nome: driver.nome })
    }

    async function confirmDelete() {
        const { error } = await supabase.from('entregadores').delete().eq('id', deleteConfirm.id)
        if (!error) {
            setDrivers(prev => prev.filter(d => d.id !== deleteConfirm.id))
            setDeleteConfirm({ open: false, id: null, nome: '' })
        } else {
            alert('Erro ao excluir entregador: ' + error.message)
        }
    }

    const distributionData = [
        { name: 'Ocupados', value: drivers.filter(d => d.status === 'Em Entrega').length || 0, color: '#C81E1E' },
        { name: 'Disponíveis', value: drivers.filter(d => d.status === 'Disponível').length || 1, color: '#3B82F6' },
        { name: 'Offline', value: drivers.filter(d => d.status === 'Offline').length || 0, color: '#9CA3AF' },
    ]

    return (
        <div className="drivers-page-wrapper animate-fade-in">
            <header className="drivers-header-premium">
                <div className="header-titles">
                    <h1>Gestão de Entregas</h1>
                    <p>Acompanhe a performance da sua equipe de motoboys em tempo real.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-add-driver" onClick={() => setIsAddOpen(true)}>
                        <Plus size={18} />
                        <span>Novo Entregador</span>
                    </button>
                </div>
            </header>

            <div className="drivers-stats-row">
                <div className="driver-stat-card">
                    <div className="stat-content">
                        <span>Entregas Hoje</span>
                        <h3>{stats.todayDeliveries}</h3>
                        <p className="trend-up"><TrendingUp size={12} /> Real time</p>
                    </div>
                    <div className="stat-icon blue"><Bike /></div>
                </div>
                <div className="driver-stat-card">
                    <div className="stat-content">
                        <span>Entregadores Ativos</span>
                        <h3>{stats.activeDrivers}</h3>
                        <p className="meta">De um total de {drivers.length} cadastrados</p>
                    </div>
                    <div className="stat-icon green"><Users /></div>
                </div>
                <div className="driver-stat-card">
                    <div className="stat-content">
                        <span>Tempo Médio</span>
                        <h3>{stats.avgTime} min</h3>
                        <p className="trend-down">Meta: 30 min</p>
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
                                    <p className="driver-tel"><Phone size={12} /> {formatPhoneDisplay(driver.tel)}</p>
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
                                    <button
                                        className="btn-delete-driver"
                                        title="Excluir"
                                        onClick={() => handleDeleteClick(driver)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
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
                                <strong>{drivers.length}</strong>
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
                            {pendingOrders.length > 0 ? pendingOrders.map(order => (
                                <div key={order.id} className="pending-row">
                                    <div className="order-num">#{order.numero_pedido}</div>
                                    <div className="order-info">
                                        <strong>{order.nome_cliente}</strong>
                                        <p>{typeof order.endereco === 'string' ? order.endereco : (order.endereco?.rua || order.endereco?.street)}</p>
                                    </div>
                                    <span className={`status ${order.status}`}>{order.status}</span>
                                </div>
                            )) : (
                                <p className="empty-pending">Nenhuma entrega pendente.</p>
                            )}
                        </div>
                        <button className="btn-assign">Atribuir Entregador</button>
                    </div>
                </aside>
            </div>

            {/* Modal de Adicionar Entregador */}
            {isAddOpen && (
                <div className="admin-modal-overlay">
                    <div className="modal-add-driver animate-scale-in">
                        <div className="modal-header-v2">
                            <h3>Cadastrar Novo Entregador</h3>
                        </div>
                        <div className="modal-body-form">
                            <div className="form-group-v2">
                                <label>Nome do Entregador</label>
                                <input
                                    type="text"
                                    placeholder="Ex: João Silva"
                                    value={newDriver.nome}
                                    onChange={e => setNewDriver({ ...newDriver, nome: e.target.value })}
                                />
                            </div>
                            <div className="form-group-v2">
                                <label>Telefone (DDD + Número)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 99991372552"
                                    value={newDriver.telefone}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                                        setNewDriver({ ...newDriver, telefone: val })
                                    }}
                                />
                                <small>Digite os 11 dígitos. O sistema formatará automaticamente.</small>
                            </div>
                        </div>
                        <div className="modal-footer-v2">
                            <button
                                className="btn-cancel-v2"
                                onClick={() => setIsAddOpen(false)}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-save-v2"
                                onClick={handleSaveDriver}
                                disabled={saving}
                            >
                                {saving ? 'Salvando...' : 'Salvar Entregador'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {deleteConfirm.open && (
                <div className="admin-modal-overlay">
                    <div className="modal-confirm-delete animate-scale-in">
                        <div className="confirm-icon-box">
                            <Trash2 size={32} />
                        </div>
                        <h2>Excluir Entregador?</h2>
                        <p>Tem certeza que deseja excluir <strong>{deleteConfirm.nome}</strong>? Esta ação removerá o histórico do entregador permanentemente.</p>

                        <div className="confirm-actions">
                            <button
                                className="btn-confirm-cancel"
                                onClick={() => setDeleteConfirm({ open: false, id: null, nome: '' })}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-confirm-delete"
                                onClick={confirmDelete}
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
