import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
    Users, Search, Filter, Mail,
    Phone, ShoppingBag, Calendar,
    MoreHorizontal, ChevronLeft, ChevronRight,
    UserPlus, ExternalLink, Trash2, Edit2, Shield, Smartphone,
    Image as ImageIcon, X, MapPin, Pencil
} from 'lucide-react'
import iconVerificImg from '../../../docs/icons/icon-verific.png'
import { supabase } from '../../lib/supabase'
import n8nService from '../../services/n8nService'
import { formatCurrency } from '../../lib/utils'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { ListPageSkeleton } from '../../components/ui/SkeletonLoader'
import { uploadImage, isCloudinaryConfigured } from '../../lib/cloudinary'
import './CustomersPage.css'



export default function CustomersPage() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [loyaltyFilter, setLoyaltyFilter] = useState('all') // 'all' | 'with_orders' | 'no_orders'
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, nome: '' })
    const [editModal, setEditModal] = useState({ open: false, mode: 'create', customer: null })
    const [formData, setFormData] = useState({ nome: '', whatsapp: '', avatar_url: '' })
    const [saving, setSaving] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [previewPhotoModal, setPreviewPhotoModal] = useState({ open: false, url: '', nome: '' })

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
            // Busca clientes já trazendo os pedidos relacionados via chave estrangeira
            const { data: customersData, error: custErr } = await supabase
                .from('clientes')
                .select('id, codigo, nome, telefone, dados, criado_em, autorizado, avatr_url, pedidos(id, valor_total, criado_em)')
                .order('criado_em', { ascending: false })

            if (custErr) throw custErr

            if (customersData) {
                const enriched = customersData.map(c => {
                    const relatedOrders = c.pedidos || []

                    const lastOrderDate = relatedOrders.length > 0
                        ? new Date(Math.max(...relatedOrders.map(p => new Date(p.criado_em)))).toLocaleDateString('pt-BR')
                        : 'Sem pedidos'

                    const avatarUrl = c.avatar_url || c.avatr_url || c.dados?.avatar_url || null
                    const addr = c.dados?.endereco || c.dados || {}
                    const parts = [
                        addr.rua || addr.street,
                        addr.numero || addr.number ? `nº ${addr.numero || addr.number}` : null,
                        addr.bairro || addr.neighborhood,
                        addr.complemento,
                        addr.referencia || addr.reference ? `Ref: ${addr.referencia || addr.reference}` : null
                    ].filter(Boolean)
                    const fullAddress = parts.length > 0 ? parts.join(', ') : 'Endereço não cadastrado'

                    return {
                        ...c,
                        avatarUrl,
                        totalOrders: relatedOrders.length,
                        lastOrder: lastOrderDate,
                        displayPhone: c.dados?.whatsapp || c.telefone || 'Não informado',
                        fullAddress,
                        addressDetails: addr
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

    const [profileModal, setProfileModal] = useState({ open: false, customer: null })

    function openEditModal(customer = null) {
        if (customer) {
            setEditModal({ open: true, mode: 'edit', customer })
            const addr = customer.dados?.endereco || customer.dados || {}
            setFormData({
                nome: customer.nome || '',
                whatsapp: customer.dados?.whatsapp || customer.telefone || '',
                avatar_url: customer.avatarUrl || '',
                rua: addr.rua || addr.street || '',
                numero: addr.numero || addr.number || '',
                bairro: addr.bairro || addr.neighborhood || '',
                complemento: addr.complemento || '',
                referencia: addr.referencia || addr.reference || ''
            })
        } else {
            setEditModal({ open: true, mode: 'create', customer: null })
            setFormData({
                nome: '',
                whatsapp: '',
                avatar_url: '',
                rua: '',
                numero: '',
                bairro: '',
                complemento: '',
                referencia: ''
            })
        }
    }

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (!isCloudinaryConfigured) {
            alert('Cloudinary não configurado. Verifique o arquivo .env')
            return
        }

        setUploadingAvatar(true)
        setUploadProgress(0)

        try {
            const result = await uploadImage(file, {
                folder: 'espetinho-vitoria/clientes',
                onProgress: (pct) => setUploadProgress(pct)
            })

            // Salvar url com otimização automática de compressão
            const optimized = result.url.replace('/upload/', '/upload/w_400,c_limit,q_auto,f_auto/')
            setFormData(prev => ({ ...prev, avatar_url: optimized }))
        } catch (err) {
            console.error('Falha no upload do avatar:', err)
            alert('Erro ao enviar imagem. Verifique sua conexão e tente novamente.')
        } finally {
            setUploadingAvatar(false)
            setUploadProgress(0)
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
                // FIX: sincronizar nome_recebedor ao editar para evitar que o
                // nome antigo sobrescreva a coluna principal quando o cliente
                // fizer um novo pedido via checkout.
                nome_recebedor: formData.nome,
                whatsapp: formData.whatsapp,
                avatar_url: formData.avatar_url || null,
                endereco: {
                    ...(baseDados.endereco || {}),
                    rua: formData.rua || '',
                    numero: formData.numero || '',
                    bairro: formData.bairro || '',
                    complemento: formData.complemento || '',
                    referencia: formData.referencia || '',
                    // FIX: também atualizar nome_recebedor dentro do endereço
                    nome_recebedor: formData.nome
                }
            }

            const payload = {
                nome: formData.nome,
                avatr_url: formData.avatar_url || null,
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
                const { error } = await supabase
                    .from('clientes')
                    .insert([payload])
                if (error) throw error
            }

            setEditModal({ open: false, mode: 'create', customer: null })
            fetchCustomers(true)
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

    const normalizeStr = (str) => {
        if (!str) return ''
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
    }

    const filteredCustomers = customers.filter(c => {
        // Loyalty filter
        if (loyaltyFilter === 'with_orders' && c.totalOrders === 0) return false
        if (loyaltyFilter === 'no_orders' && c.totalOrders > 0) return false

        if (!searchTerm || !searchTerm.trim()) return true
        
        const termNorm = normalizeStr(searchTerm)
        const digitsOnly = searchTerm.replace(/\D/g, '')

        const nameNorm = normalizeStr(c.nome)
        const receiverNorm = normalizeStr(c.dados?.nome_recebedor)
        const codeNorm = normalizeStr(c.codigo)
        const emailNorm = normalizeStr(c.email)
        const addrNorm = normalizeStr(c.fullAddress)

        if (
            nameNorm.includes(termNorm) ||
            receiverNorm.includes(termNorm) ||
            codeNorm.includes(termNorm) ||
            emailNorm.includes(termNorm) ||
            addrNorm.includes(termNorm)
        ) {
            return true
        }

        if (digitsOnly.length >= 2) {
            const phoneDigits = (c.telefone || '').replace(/\D/g, '')
            const whatsappDigits = (c.dados?.whatsapp || '').replace(/\D/g, '')
            const receiverPhoneDigits = (c.dados?.telefone_recebedor || '').replace(/\D/g, '')
            const displayDigits = (c.displayPhone || '').replace(/\D/g, '')

            const allDigits = [phoneDigits, whatsappDigits, receiverPhoneDigits, displayDigits].filter(Boolean)

            for (const pd of allDigits) {
                if (pd.includes(digitsOnly)) return true
                const noCountryCode = pd.startsWith('55') ? pd.substring(2) : pd
                if (noCountryCode.includes(digitsOnly)) return true
                if (digitsOnly.includes(noCountryCode) || digitsOnly.includes(pd)) return true
            }
        }

        return false
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
            await n8nService.sendLinkApp({
                telefone: phoneRaw,
                codigo: customer.codigo
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

    if (loading) return <ListPageSkeleton rows={6} showStats />

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
                            type="search"
                            inputMode="search"
                            autoCapitalize="none"
                            autoComplete="off"
                            placeholder="Buscar por nome, WhatsApp ou e-mail..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => setSearchTerm('')}
                                title="Limpar busca"
                                aria-label="Limpar busca"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                    <div className="toolbar-actions">
                        <div className="loyalty-filter-chips">
                            <button
                                className={`chip ${loyaltyFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setLoyaltyFilter('all')}
                            >
                                Todos
                            </button>
                            <button
                                className={`chip chip-orders ${loyaltyFilter === 'with_orders' ? 'active' : ''}`}
                                onClick={() => setLoyaltyFilter('with_orders')}
                            >
                                <ShoppingBag size={13} /> Com pedidos
                            </button>
                            <button
                                className={`chip chip-new ${loyaltyFilter === 'no_orders' ? 'active' : ''}`}
                                onClick={() => setLoyaltyFilter('no_orders')}
                            >
                                Sem pedidos
                            </button>
                        </div>
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
                                <tr
                                    key={customer.id}
                                    className="customer-clickable-row"
                                    onClick={() => setProfileModal({ open: true, customer })}
                                >
                                    <td>
                                        <div className="customer-cell">
                                            <div className="avatar-wrapper">
                                                {customer.avatarUrl ? (
                                                    <img
                                                        src={customer.avatarUrl}
                                                        alt={customer.nome}
                                                        className="customer-avatar-img"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none'
                                                            e.target.nextSibling.style.display = 'flex'
                                                        }}
                                                    />
                                                ) : null}
                                                <div
                                                    className="avatar avatar-fallback"
                                                    style={{ display: customer.avatarUrl ? 'none' : 'flex' }}
                                                >
                                                    {customer.nome ? customer.nome.charAt(0).toUpperCase() : '?'}
                                                </div>
                                            </div>
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
                                    <td onClick={e => e.stopPropagation()}>
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
                                    <td onClick={e => e.stopPropagation()}>
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

            {/* Modal de Criar/Editar Cliente — Portal para evitar bug de scroll */}
            {editModal.open && createPortal(
                <div
                    className="admin-modal-overlay"
                    onClick={() => setEditModal({ open: false, mode: 'create', customer: null })}
                >
                    <div
                        className="modal-edit-customer animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2>{editModal.mode === 'edit' ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                            <p>{editModal.mode === 'edit' ? 'Altere as informações abaixo.' : 'Preencha os dados do novo cliente.'}</p>
                        </div>

                        <div className="modal-body">
                            {/* Cabeçalho do Cliente: Foto Maior na Esquerda + Nome e Telefone ao Lado */}
                            <div className="modal-customer-profile-header">
                                <div className="modal-customer-avatar-box">
                                    {formData.avatar_url ? (
                                        <div
                                            className="modal-avatar-clickable"
                                            title="Clique para ampliar a foto"
                                            onClick={() => setPreviewPhotoModal({ open: true, url: formData.avatar_url, nome: formData.nome })}
                                        >
                                            <img
                                                src={formData.avatar_url}
                                                alt={formData.nome || 'Avatar'}
                                                className="modal-avatar-large-img"
                                            />
                                            <span className="modal-avatar-zoom-badge">🔍 Ampliar</span>
                                        </div>
                                    ) : (
                                        <div className="modal-avatar-large-fallback">
                                            {formData.nome ? formData.nome.charAt(0).toUpperCase() : <Users size={32} />}
                                        </div>
                                    )}
                                </div>

                                <div className="modal-customer-info-fields">
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
                            </div>

                            <div className="input-group-heading" style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: 'var(--cor-primaria, #FF6A00)' }}>
                                📍 Endereço de Entrega
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                                <div className="input-group">
                                    <label>Rua / Logradouro</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Av. Principal"
                                        value={formData.rua}
                                        onChange={e => setFormData({ ...formData, rua: e.target.value })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Número</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 123"
                                        value={formData.numero}
                                        onChange={e => setFormData({ ...formData, numero: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group">
                                    <label>Bairro</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Centro"
                                        value={formData.bairro}
                                        onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Complemento</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Apt 102"
                                        value={formData.complemento}
                                        onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Ponto de Referência</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Próximo à praça principal"
                                    value={formData.referencia}
                                    onChange={e => setFormData({ ...formData, referencia: e.target.value })}
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
                </div>,
                document.body
            )}

            {/* Modal do Perfil do Cliente — Design Fiel ao Card */}
            {profileModal.open && profileModal.customer && createPortal(
                <div
                    className="admin-modal-overlay customer-profile-card-overlay"
                    onClick={() => setProfileModal({ open: false, customer: null })}
                >
                    <div
                        className="customer-profile-card animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Botão de Fechar discreto */}
                        <button
                            type="button"
                            className="customer-profile-card__close"
                            onClick={() => setProfileModal({ open: false, customer: null })}
                            title="Fechar"
                        >
                            <X size={16} />
                        </button>

                        {/* Top Banner com o Botão de Editar (Lápis) no lugar do + */}
                        <div className="customer-profile-card__banner">
                            <button
                                type="button"
                                className="customer-profile-card__edit-btn"
                                title="Editar Cliente"
                                onClick={() => {
                                    const cust = profileModal.customer
                                    setProfileModal({ open: false, customer: null })
                                    openEditModal(cust)
                                }}
                            >
                                <Pencil size={18} strokeWidth={2.2} />
                            </button>
                        </div>

                        {/* Avatar com borda branca e o ícone de verificado azul logo acima/ao lado */}
                        <div className="customer-profile-card__avatar-section">
                            <div className="customer-profile-card__avatar-wrap">
                                {profileModal.customer.avatarUrl ? (
                                    <img
                                        src={profileModal.customer.avatarUrl}
                                        alt={profileModal.customer.nome}
                                        className="customer-profile-card__avatar-img"
                                        onError={e => {
                                            e.target.style.display = 'none'
                                            e.target.nextSibling.style.display = 'flex'
                                        }}
                                    />
                                ) : null}
                                <div
                                    className="customer-profile-card__avatar-fallback"
                                    style={{ display: profileModal.customer.avatarUrl ? 'none' : 'flex' }}
                                >
                                    {profileModal.customer.nome ? profileModal.customer.nome.charAt(0).toUpperCase() : <Users size={32} />}
                                </div>
                            </div>
                        </div>

                        {/* Nome do Cliente com o Badge Verificado */}
                        <div className="customer-profile-card__body">
                            <div className="customer-profile-card__name-row">
                                <h2 className="customer-profile-card__name">{profileModal.customer.nome}</h2>
                                <img
                                    src={iconVerificImg}
                                    alt="Verificado"
                                    className="customer-profile-card__verific-icon"
                                />
                            </div>

                            {/* Telefone / WhatsApp */}
                            <div className="customer-profile-card__phone-row">
                                <Phone size={14} className="customer-profile-card__phone-icon" />
                                <span className="customer-profile-card__phone-text">{profileModal.customer.displayPhone}</span>
                            </div>

                            {/* Endereço Completo */}
                            <div className="customer-profile-card__address-box">
                                <MapPin size={15} className="customer-profile-card__address-icon" />
                                <span className="customer-profile-card__address-text">
                                    {profileModal.customer.fullAddress}
                                </span>
                            </div>

                            {/* Contador de Pedidos */}
                            <div className="customer-profile-card__stats-row">
                                <div className="customer-profile-card__stat-item">
                                    <span className="customer-profile-card__stat-val">
                                        {profileModal.customer.totalOrders || 0}
                                    </span>
                                    <span className="customer-profile-card__stat-lbl">Pedidos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Confirmação de Exclusão — Portal */}
            {deleteConfirm.open && createPortal(
                <div
                    className="admin-modal-overlay"
                    onClick={() => setDeleteConfirm({ open: false, id: null, nome: '' })}
                >
                    <div
                        className="modal-confirm-delete animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="confirm-icon-box">
                            <Trash2 size={28} />
                        </div>

                        <h2>Excluir Cliente?</h2>

                        <p>
                            Tem certeza que deseja excluir <strong>{deleteConfirm.nome}</strong>?
                            Esta ação removerá o histórico deste cliente permanentemente.
                        </p>

                        <div className="confirm-warning-tag">
                            ⚠️ Esta ação não pode ser desfeita
                        </div>

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
                                <Trash2 size={14} />
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Foto Ampliada (Lightbox) — Portal */}
            {previewPhotoModal.open && createPortal(
                <div
                    className="admin-modal-overlay photo-preview-overlay"
                    onClick={() => setPreviewPhotoModal({ open: false, url: '', nome: '' })}
                >
                    <div
                        className="photo-preview-content animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="photo-preview-close"
                            onClick={() => setPreviewPhotoModal({ open: false, url: '', nome: '' })}
                            title="Fechar"
                        >
                            <X size={20} />
                        </button>
                        <img
                            src={previewPhotoModal.url}
                            alt={previewPhotoModal.nome || 'Foto do Cliente'}
                            className="photo-preview-img"
                        />
                        {previewPhotoModal.nome && (
                            <div className="photo-preview-caption">
                                <strong>{previewPhotoModal.nome}</strong>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
