import { useState, useEffect, useCallback } from 'react'
import {
    Users, Search, Filter, Mail,
    Phone, ShoppingBag, Calendar,
    MoreHorizontal, ChevronLeft, ChevronRight,
    UserPlus, ExternalLink, Trash2, Edit2, Shield, Smartphone
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import './CustomersPage.css'



export default function CustomersPage() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, nome: '' })
    const [editModal, setEditModal] = useState({ open: false, mode: 'create', customer: null })
    const [formData, setFormData] = useState({ nome: '', whatsapp: '' })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchCustomers()
    }, [])

    // Wake-from-sleep: re-fetch customers silently
    useVisibilityRefresh(useCallback(() => {
        console.log('[CustomersPage] Woke from sleep — refreshing silently')
        fetchCustomers(true)
    }, []))

    async function fetchCustomers(isSilent = false) {
        if (!isSilent) setLoading(true)
        try {
            // Specify columns explicitly to avoid 406 errors and optimize fetch
            const { data: customersData, error: custErr } = await supabase
                .from('clientes')
                .select('id, codigo, nome, telefone, dados, criado_em, autorizado')
                .order('criado_em', { ascending: false })

            if (custErr) throw custErr

            const { data: allOrders, error: ordersErr } = await supabase
                .from('pedidos')
                .select('valor_total, criado_em, telefone_cliente, cliente_id')

            if (ordersErr) console.warn('[fetchCustomers] Erro ao buscar pedidos relacionados:', ordersErr)

            if (customersData) {
                const enriched = customersData.map(c => {
                    const phoneRaw = c.telefone?.replace(/\D/g, '') || ''
                    const whatsappRaw = c.dados?.whatsapp?.replace(/\D/g, '') || ''

                    const relatedOrders = allOrders?.filter(p => {
                        if (p.cliente_id === c.id) return true
                        const pPhone = p.telefone_cliente?.replace(/\D/g, '') || ''
                        return pPhone && (pPhone === phoneRaw || pPhone === whatsappRaw)
                    }) || []

                    const lastOrderDate = relatedOrders.length > 0
                        ? new Date(Math.max(...relatedOrders.map(p => new Date(p.criado_em)))).toLocaleDateString('pt-BR')
                        : 'Sem pedidos'

                    return {
                        ...c,
                        totalOrders: relatedOrders.length,
                        lastOrder: lastOrderDate,
                        displayPhone: c.dados?.whatsapp || c.telefone || 'Não informado'
                    }
                })
                setCustomers(enriched)
            }
        } catch (err) {
            console.error('[fetchCustomers] Erro crítico:', err)
            // Error is handled by not setting customers, keeping loading false
        } finally {
            setLoading(false)
        }
    }

    function openEditModal(customer = null) {
        if (customer) {
            setEditModal({ open: true, mode: 'edit', customer })
            setFormData({
                nome: customer.nome || '',
                whatsapp: customer.dados?.whatsapp || customer.telefone || ''
            })
        } else {
            setEditModal({ open: true, mode: 'create', customer: null })
            setFormData({ nome: '', whatsapp: '' })
        }
    }

    async function handleSave() {
        if (!formData.nome || !formData.whatsapp) {
            alert('Por favor, preencha nome e whatsapp.')
            return
        }

        setSaving(true)
        try {
            const isEdit = editModal.mode === 'edit'
            const customer = editModal.customer

            // Prepare dados JSONB (merge with existing or create new)
            const baseDados = isEdit ? (customer.dados || {}) : {}
            const updatedDados = {
                ...baseDados,
                nome: formData.nome,
                whatsapp: formData.whatsapp
            }

            const payload = {
                nome: formData.nome,
                // telefone: DO NOT UPDATE THIS FIELD (Per user request)
                dados: updatedDados
            }

            if (isEdit) {
                const { error } = await supabase
                    .from('clientes')
                    .update(payload)
                    .eq('id', customer.id)
                if (error) throw error
            } else {
                // For new customers, we also don't touch 'telefone' if possible, 
                // but we might need it for initial identification if dados isn't enough.
                // However, user said "nunca mexa", so we set it only in dados.
                const { error } = await supabase
                    .from('clientes')
                    .insert([payload])
                if (error) throw error
            }

            setEditModal({ open: false, mode: 'create', customer: null })
            fetchCustomers()
        } catch (err) {
            alert('Erro ao salvar: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteClick(customer) {
        setDeleteConfirm({ open: true, id: customer.id, nome: customer.nome })
    }

    async function confirmDelete() {
        const { error } = await supabase.from('clientes').delete().eq('id', deleteConfirm.id)
        if (!error) {
            setCustomers(prev => prev.filter(c => c.id !== deleteConfirm.id))
            setDeleteConfirm({ open: false, id: null, nome: '' })
        } else {
            alert('Erro ao excluir cliente: ' + error.message)
        }
    }

    const filteredCustomers = customers.filter(c => {
        const searchLow = searchTerm.toLowerCase()
        const searchDigits = searchTerm.replace(/\D/g, '')

        // Match by Name or Email
        const matchesText = c.nome.toLowerCase().includes(searchLow) ||
            c.email?.toLowerCase().includes(searchLow)

        // Match by Phone (raw digits or formatted)
        const phoneDigits = c.displayPhone?.replace(/\D/g, '') || ''
        const matchesPhone = (searchDigits && phoneDigits.includes(searchDigits)) ||
            c.displayPhone?.toLowerCase().includes(searchLow)

        return matchesText || matchesPhone
    })

    async function toggleAutorizado(id, newVal) {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, autorizado: newVal } : c))
        try {
            const { error } = await supabase.from('clientes').update({ autorizado: newVal }).eq('id', id)
            if (error) throw error
        } catch (err) {
            alert('Erro ao atualizar autorização: ' + err.message)
            setCustomers(prev => prev.map(c => c.id === id ? { ...c, autorizado: !newVal } : c))
        }
    }

    async function enviarLinkApp(customer) {
        const phoneRaw = customer.displayPhone.replace(/\D/g, '')
        if (!phoneRaw) {
            alert('Cliente não possui telefone cadastrado.')
            return
        }
        try {
            await fetch('https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/enviar_link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: phoneRaw,
                    codigo: customer.codigo
                })
            })
            alert(`✅ Link do App enviado com sucesso para ${customer.nome} no WhatsApp!`)
        } catch (err) {
            console.error('Erro ao enviar link:', err)
            // Silently complete or alert minimally since n8n handles the heavy lifting
            alert('Aviso: O gatilho de envio disparou, mas pode ter ocorrido uma falha de conexão local.')
        }
    }

    const handleExportCSV = () => {
        if (!filteredCustomers || filteredCustomers.length === 0) {
            alert('Nenhum cliente para exportar.')
            return
        }

        const headers = ['Nome', 'Telefone', 'Email', 'Qtd Pedidos', 'Total Gasto', 'Ultima Compra']
        const rows = filteredCustomers.map(c => [
            c.nome,
            c.telefone || c.displayPhone || '',
            c.email || '',
            c.total_pedidos || 0,
            c.total_gasto ? `R$ ${c.total_gasto.toFixed(2)}` : 'R$ 0,00',
            c.ultima_compra || 'Nenhuma'
        ])

        // Add BOM \uFEFF to support Excel formatting with special characters in Portuguese
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `clientes_espetinho_vitoria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (loading) return <div className="admin-loading">Carregando clientes...</div>

    return (
        <div className="customers-page-wrapper animate-fade-in">
            <header className="customers-header-premium">
                <div className="header-titles">
                    <h1>Gestão de Clientes</h1>
                    <p>Gerencie sua base de clientes e programas de fidelidade.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-add-customer" onClick={() => openEditModal()}>
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
                        <span>Fidelidade</span>
                        <h3>{customers.filter(c => c.totalOrders > 10).length}</h3>
                    </div>
                </div>
            </div>

            <div className="customers-table-container">
                <div className="table-toolbar">
                    <div className="search-bar-v3">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, WhatsApp ou e-mail..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="toolbar-actions">
                        <button className="btn-outline"><Filter size={18} /> Filtros</button>
                        <button className="btn-outline" onClick={handleExportCSV}>Exportar</button>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="customers-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>WhatsApp / Contato</th>
                                <th>Qtd. Pedidos</th>
                                <th>Última Compra</th>
                                <th>Autorizado</th>
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
                                    <td>
                                        <div className="contact-cell">
                                            <span className="phone-val"><Phone size={14} /> {customer.displayPhone}</span>
                                            {customer.email && <span className="email-val"><Mail size={14} /> {customer.email}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="orders-badge">
                                            <ShoppingBag size={14} />
                                            <span>{customer.totalOrders}</span>
                                        </div>
                                    </td>
                                    <td>{customer.lastOrder}</td>
                                    <td>
                                        <div className="toggle-switch-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!customer.autorizado}
                                                    onChange={(e) => toggleAutorizado(customer.id, e.target.checked)}
                                                    style={{ opacity: 0, width: 0, height: 0 }}
                                                />
                                                <span className="slider round" style={{
                                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                                    backgroundColor: customer.autorizado ? 'var(--cor-sucesso, #10b981)' : '#ccc',
                                                    transition: '.4s', borderRadius: '34px'
                                                }}>
                                                    <span style={{
                                                        position: 'absolute', content: '""', height: '14px', width: '14px',
                                                        left: customer.autorizado ? '19px' : '3px', bottom: '3px',
                                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                                    }} />
                                                </span>
                                            </label>
                                            {customer.autorizado && <Shield size={14} color="var(--cor-sucesso, #10b981)" />}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="actions-cell">
                                            <button title="Enviar Link do App" onClick={() => enviarLinkApp(customer)} style={{ color: '#10b981' }}><Smartphone size={16} /></button>
                                            <button title="Ver Detalhes" onClick={() => window.open(`https://wa.me/${customer.displayPhone.replace(/\D/g, '')}`, '_blank')}><ExternalLink size={16} /></button>
                                            <button title="Editar" onClick={() => openEditModal(customer)}><Edit2 size={16} /></button>
                                            <button className="danger" title="Excluir" onClick={() => handleDeleteClick(customer)}><Trash2 size={16} /></button>
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

            {/* Modal de Criar/Editar Cliente */}
            {editModal.open && (
                <div className="admin-modal-overlay">
                    <div className="modal-edit-customer animate-scale-in">
                        <div className="modal-header">
                            <h2>{editModal.mode === 'edit' ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                            <p>{editModal.mode === 'edit' ? 'Altere as informações abaixo.' : 'Preencha os dados do novo cliente.'}</p>
                        </div>

                        <div className="modal-body">
                            <div className="input-group">
                                <label>Nome do Cliente</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Alan Silva"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>

                            <div className="input-group">
                                <label>WhatsApp / Telefone</label>
                                <input
                                    type="text"
                                    placeholder="Ex: (99) 99999-9999"
                                    value={formData.whatsapp}
                                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-cancel"
                                onClick={() => setEditModal({ open: false, mode: 'create', customer: null })}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-save"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Salvando...' : 'Salvar Cliente'}
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
                        <h2>Excluir Cliente?</h2>
                        <p>Tem certeza que deseja excluir <strong>{deleteConfirm.nome}</strong>? Esta ação removerá o histórico deste cliente permanentemente.</p>

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
