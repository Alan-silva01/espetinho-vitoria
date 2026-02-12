import { useState, useEffect } from 'react'
import {
    Users, Search, Filter, Mail,
    Phone, ShoppingBag, Calendar,
    MoreHorizontal, ChevronLeft, ChevronRight,
    UserPlus, ExternalLink, Trash2, Edit2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './CustomersPage.css'

export default function CustomersPage() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchCustomers()
    }, [])

    async function fetchCustomers() {
        setLoading(true)
        const { data } = await supabase
            .from('clientes')
            .select('*')
            .order('criado_em', { ascending: false })

        // Mocking some stats for the table
        const enriched = data?.map(c => ({
            ...c,
            totalOrders: Math.floor(Math.random() * 15) + 1,
            totalSpent: Math.random() * 1000 + 200,
            lastOrder: new Date().toLocaleDateString('pt-BR')
        })) || []

        setCustomers(enriched)
        setLoading(false)
    }

    const filteredCustomers = customers.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.codigo_indicacao.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return <div className="admin-loading">Carregando clientes...</div>

    return (
        <div className="customers-page-wrapper animate-fade-in">
            <header className="customers-header-premium">
                <div className="header-titles">
                    <h1>Gestão de Clientes</h1>
                    <p>Gerencie sua base de clientes e programas de fidelidade.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-add-customer">
                        <UserPlus size={18} />
                        <span>Novo Cliente</span>
                    </button>
                </div>
            </header>

            <div className="customers-stats-grid">
                <div className="c-stat-card">
                    <div className="c-stat-icon"><Users /></div>
                    <div className="c-stat-info">
                        <span>Total de Clientes</span>
                        <h3>{customers.length}</h3>
                    </div>
                </div>
                <div className="c-stat-card">
                    <div className="c-stat-icon blue"><ShoppingBag /></div>
                    <div className="c-stat-info">
                        <span>Clientes Ativos</span>
                        <h3>{customers.filter(c => c.totalOrders > 5).length}</h3>
                    </div>
                </div>
                <div className="c-stat-card">
                    <div className="c-stat-icon green"><Calendar /></div>
                    <div className="c-stat-info">
                        <span>Novos (Este Mês)</span>
                        <h3>12</h3>
                    </div>
                </div>
            </div>

            <div className="customers-table-container">
                <div className="table-toolbar">
                    <div className="search-bar-v3">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou código..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="toolbar-actions">
                        <button className="btn-outline"><Filter size={18} /> Filtros</button>
                        <button className="btn-outline">Exportar</button>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="customers-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Código</th>
                                <th>Contato</th>
                                <th>Pedidos</th>
                                <th>Total Gasto</th>
                                <th>Última Compra</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map(customer => (
                                <tr key={customer.id}>
                                    <td>
                                        <div className="customer-cell">
                                            <div className="avatar">{customer.nome.charAt(0)}</div>
                                            <div className="info">
                                                <strong>{customer.nome}</strong>
                                                <span>Cadastrado em {new Date(customer.criado_em).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><code className="ref-code">{customer.codigo_indicacao}</code></td>
                                    <td>
                                        <div className="contact-cell">
                                            <span title={customer.email}><Mail size={14} /> Email</span>
                                            <span><Phone size={14} /> (--) ----- ----</span>
                                        </div>
                                    </td>
                                    <td>{customer.totalOrders}</td>
                                    <td><strong className="spent-val">{formatCurrency(customer.totalSpent)}</strong></td>
                                    <td>{customer.lastOrder}</td>
                                    <td>
                                        <div className="actions-cell">
                                            <button title="Ver Detalhes"><ExternalLink size={16} /></button>
                                            <button title="Editar"><Edit2 size={16} /></button>
                                            <button className="danger" title="Excluir"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <span>Exibindo {filteredCustomers.length} de {customers.length} clientes</span>
                    <div className="pagination-ctrls">
                        <button disabled><ChevronLeft size={20} /></button>
                        <button className="active">1</button>
                        <button><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>
        </div>
    )
}
