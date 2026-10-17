import { useState, useEffect } from 'react'
import {
    Search, User, Phone, MapPin, X, ExternalLink, UserPlus, Sparkles, ArrowRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatPhone, formatPhoneForDatabaseWhatsApp } from '../../lib/utils'
import './CreateOrderModal.css'

export default function CreateOrderModal({ isOpen, onClose }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [customerResults, setCustomerResults] = useState([])
    const [searchingCustomers, setSearchingCustomers] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [isCreatingNew, setIsCreatingNew] = useState(false)

    // Form para novo cliente
    const [newName, setNewName] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [isSubmittingNew, setIsSubmittingNew] = useState(false)
    const [duplicateCustomer, setDuplicateCustomer] = useState(null)

    // Formata o telefone enquanto o usuário digita: (XX) 9XXXX-XXXX
    function handlePhoneChange(e) {
        let v = e.target.value.replace(/\D/g, '')
        if (v.length > 11) v = v.slice(0, 11)

        let formatted = v
        if (v.length > 6) {
            formatted = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
        } else if (v.length > 2) {
            formatted = `(${v.slice(0, 2)}) ${v.slice(2)}`
        } else if (v.length > 0) {
            formatted = `(${v}`
        }
        setNewPhone(formatted)
    }

    // Reset ao abrir/fechar
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('')
            setCustomerResults([])
            setSelectedCustomer(null)
            setIsCreatingNew(false)
            setNewName('')
            setNewPhone('')
            setDuplicateCustomer(null)
        }
    }, [isOpen])

    function matchCustomer(c, term, digitsOnly) {
        if (!c) return false
        const nameLower = (c.nome || '').toLowerCase()
        const codeLower = (c.codigo || '').toLowerCase()
        const termLower = term.toLowerCase()

        if (nameLower.includes(termLower) || codeLower.includes(termLower)) {
            return true
        }

        if (digitsOnly.length >= 3) {
            const phoneDigits = (c.telefone || '').replace(/\D/g, '')
            const whatsappDigits = (c.dados?.whatsapp || '').replace(/\D/g, '')
            const recipientDigits = (c.dados?.endereco?.telefone_recebedor || '').replace(/\D/g, '')

            const allDigits = [phoneDigits, whatsappDigits, recipientDigits].filter(Boolean)

            for (const pd of allDigits) {
                if (pd.includes(digitsOnly)) return true
                const noCountryCode = pd.startsWith('55') ? pd.substring(2) : pd
                if (noCountryCode.includes(digitsOnly)) return true
                if (digitsOnly.includes(noCountryCode) || digitsOnly.includes(pd)) return true
            }
        }

        return false
    }

    // Busca de clientes com Debounce e filtro inteligente por dígitos
    useEffect(() => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setCustomerResults([])
            return
        }

        const timer = setTimeout(async () => {
            setSearchingCustomers(true)
            try {
                const term = searchTerm.trim()
                const digitsOnly = term.replace(/\D/g, '')

                let rawData = []

                if (digitsOnly.length >= 3) {
                    const { data } = await supabase
                        .from('clientes')
                        .select('id, codigo, nome, telefone, avatr_url, dados')
                        .or(`nome.ilike.%${term}%,codigo.ilike.%${term}%,telefone.ilike.%${digitsOnly}%,dados->>whatsapp.ilike.%${digitsOnly}%`)
                        .order('criado_em', { ascending: false })
                        .limit(50)
                    rawData = data || []
                } else {
                    const { data } = await supabase
                        .from('clientes')
                        .select('id, codigo, nome, telefone, avatr_url, dados')
                        .or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`)
                        .limit(30)
                    rawData = data || []
                }

                // Fallback: if searching by phone digits and OR query yielded 0 results, fetch recent clients to filter in JS
                if (rawData.length === 0 && digitsOnly.length >= 4) {
                    const { data: fallbackData } = await supabase
                        .from('clientes')
                        .select('id, codigo, nome, telefone, avatr_url, dados')
                        .order('criado_em', { ascending: false })
                        .limit(200)

                    rawData = fallbackData || []
                }

                const filtered = rawData.filter(c => matchCustomer(c, term, digitsOnly))
                setCustomerResults(filtered.slice(0, 15))
            } catch (err) {
                console.error('Erro ao buscar clientes:', err)
            } finally {
                setSearchingCustomers(false)
            }
        }, 250)

        return () => clearTimeout(timer)
    }, [searchTerm])

    if (!isOpen) return null

    // Abrir o app do cliente pelo código
    function handleOpenCustomerApp(customer) {
        if (!customer || !customer.codigo) return
        sessionStorage.setItem('espetinho_opened_from_admin', 'true')
        window.location.href = `/${customer.codigo}?admin=true`
    }

    // Criar novo cliente e abrir o app dele imediatamente
    async function handleCreateAndOpenApp(e) {
        e?.preventDefault()
        if (!newName.trim()) {
            alert('Por favor, informe o nome do cliente.')
            return
        }

        setIsSubmittingNew(true)
        try {
            const rawPhone = newPhone.replace(/\D/g, '')
            const generatedCode = 'CLI-' + Math.random().toString(36).substring(2, 8).toUpperCase()
            const whatsappDbFormat = formatPhoneForDatabaseWhatsApp(rawPhone) || rawPhone
            const displayWhatsapp = formatPhone(rawPhone) || rawPhone

            const payload = {
                nome: newName.trim(),
                telefone: whatsappDbFormat,
                codigo: generatedCode,
                dados: {
                    nome: newName.trim(),
                    whatsapp: displayWhatsapp
                }
            }

            const { data, error } = await supabase
                .from('clientes')
                .insert([payload])
                .select()
                .single()

            if (error) {
                // Tratamento especial para telefone duplicado
                if (error.code === '23505' || error.message?.includes('clientes_telefone_key') || error.message?.includes('duplicate key')) {
                    // Buscar o cliente já existente pelo telefone
                    const { data: existingClient } = await supabase
                        .from('clientes')
                        .select('id, codigo, nome, telefone, avatr_url, dados')
                        .or(`telefone.eq.${whatsappDbFormat},telefone.ilike.%${rawPhone}%,dados->>whatsapp.ilike.%${rawPhone}%`)
                        .limit(1)
                        .maybeSingle()

                    if (existingClient) {
                        setDuplicateCustomer(existingClient)
                        return
                    } else {
                        setDuplicateCustomer({
                            nome: newName.trim(),
                            telefone: whatsappDbFormat,
                            dados: { whatsapp: displayWhatsapp }
                        })
                        return
                    }
                }
                throw error
            }

            handleOpenCustomerApp(data)
        } catch (err) {
            console.error('[CreateOrderModal] Erro ao cadastrar cliente:', err)
            alert('Não foi possível cadastrar o cliente: ' + (err.message || 'Erro desconhecido.'))
        } finally {
            setIsSubmittingNew(false)
        }
    }

    return (
        <div className="create-order-overlay" onClick={onClose}>
            <div className="create-order-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                {/* Cabeçalho no padrão do sistema */}
                <div className="create-order-header">
                    <div>
                        <h2>NOVO PEDIDO PARA CLIENTE</h2>
                        <p>Selecione o cliente para abrir o cardápio com os dados pré-identificados</p>
                    </div>
                    <button className="btn-close-modal" onClick={onClose} title="Fechar (ESC)">
                        <X size={18} />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="create-order-body" style={{ padding: '20px' }}>
                    {!isCreatingNew ? (
                        <div className="section-box">
                            <h3><User size={16} /> Buscar Cliente Cadastrado</h3>

                            <div className="search-input-wrapper" style={{ marginTop: '10px' }}>
                                <Search size={16} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Digite o Nome, Código ou WhatsApp do cliente..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {searchingCustomers && (
                                <div className="searching-spinner" style={{ margin: '14px 0', fontSize: '12px', color: '#737373' }}>
                                    Buscando clientes...
                                </div>
                            )}

                            {customerResults.length > 0 && (
                                <div className="customer-results-list" style={{ marginTop: '12px', maxHeight: '260px' }}>
                                    {customerResults.map(c => {
                                        const avatar = c.avatr_url || c.dados?.avatar_url || null
                                        const rawPhone = c.dados?.whatsapp || c.telefone || ''
                                        const displayPhone = formatPhone(rawPhone) || 'Sem telefone'

                                        return (
                                            <div
                                                key={c.id}
                                                className="customer-result-item"
                                                onClick={() => handleOpenCustomerApp(c)}
                                            >
                                                <div className="cust-avatar-badge">
                                                    {avatar ? (
                                                        <img
                                                            src={avatar}
                                                            alt={c.nome || 'Cliente'}
                                                            className="cust-avatar-img"
                                                            onError={e => {
                                                                e.target.style.display = 'none'
                                                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span style={{ display: avatar ? 'none' : 'flex' }}>
                                                        {(c.nome || 'C').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="cust-info">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <strong>{c.nome}</strong>
                                                        {c.codigo && (
                                                            <span className="cust-code-badge">
                                                                {c.codigo}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: '#737373', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Phone size={12} /> {displayPhone}
                                                    </span>
                                                </div>
                                                <button className="btn-select-cust" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>Iniciar Pedido</span>
                                                    <ExternalLink size={13} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {searchTerm.length >= 2 && customerResults.length === 0 && !searchingCustomers && (
                                <div className="no-customer-found" style={{ marginTop: '14px' }}>
                                    <span>Nenhum cliente encontrado com "{searchTerm}".</span>
                                    <button
                                        className="btn-new-cust-action"
                                        onClick={() => {
                                            setNewName(searchTerm)
                                            setIsCreatingNew(true)
                                        }}
                                    >
                                        <UserPlus size={16} /> Cadastrar "{searchTerm}"
                                    </button>
                                </div>
                            )}

                            {!searchTerm && (
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <button
                                        className="btn-stepper-nav secondary"
                                        onClick={() => setIsCreatingNew(true)}
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        <UserPlus size={16} /> Cadastrar Novo Cliente Manualmente
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Formulário para Novo Cliente */
                        <form onSubmit={handleCreateAndOpenApp} className="section-box animate-fade-in">
                            <h3><UserPlus size={18} /> Cadastrar Novo Cliente</h3>

                            <div className="input-group" style={{ marginTop: '12px' }}>
                                <label>Nome do Cliente *</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Alan Silva"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="input-group" style={{ marginTop: '12px' }}>
                                <label>WhatsApp / Telefone</label>
                                <input
                                    type="text"
                                    placeholder="Ex: (99) 99137-2552"
                                    value={newPhone}
                                    onChange={handlePhoneChange}
                                    maxLength={16}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button
                                    type="button"
                                    className="btn-stepper-nav secondary"
                                    onClick={() => setIsCreatingNew(false)}
                                    style={{ flex: 1, justifyContent: 'center' }}
                                >
                                    Voltar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-confirm-order"
                                    disabled={isSubmittingNew}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    {isSubmittingNew ? 'Cadastrando...' : <>Cadastrar & Iniciar <ArrowRight size={16} /></>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Modal de Aviso: Cliente já cadastrado */}
            {duplicateCustomer && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10060,
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={() => setDuplicateCustomer(null)}
                >
                    <div
                        style={{
                            background: '#FFFFFF',
                            border: '1.5px solid #232220',
                            width: '100%',
                            maxWidth: '400px',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                            overflow: 'hidden'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{
                            background: '#232220',
                            color: '#FFFFFF',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.05em' }}>CLIENTE JÁ CADASTRADO</span>
                            <button
                                type="button"
                                onClick={() => setDuplicateCustomer(null)}
                                style={{ background: 'transparent', border: 'none', color: '#a3a3a3', cursor: 'pointer', padding: 2 }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: '#404040', lineHeight: 1.5 }}>
                                Este número de WhatsApp já pertence a um cliente no sistema:
                            </p>
                            <div style={{
                                background: '#F5F5F5',
                                border: '1px solid #E5E5E5',
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    background: '#232220',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    overflow: 'hidden'
                                }}>
                                    {duplicateCustomer.avatr_url || duplicateCustomer.dados?.avatar_url ? (
                                        <img
                                            src={duplicateCustomer.avatr_url || duplicateCustomer.dados?.avatar_url}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <span>{(duplicateCustomer.nome || 'C').charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                    <strong style={{ fontSize: '14px', color: '#171717' }}>{duplicateCustomer.nome || 'Cliente'}</strong>
                                    <span style={{ fontSize: '12px', color: '#737373' }}>
                                        {formatPhone(duplicateCustomer.dados?.whatsapp || duplicateCustomer.telefone)}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => setDuplicateCustomer(null)}
                                    style={{
                                        padding: '8px 14px',
                                        border: '1px solid #D4D4D4',
                                        background: '#FFFFFF',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Corrigir Número
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDuplicateCustomer(null)
                                        handleOpenCustomerApp(duplicateCustomer)
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        background: '#16A34A',
                                        color: '#FFFFFF',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>Ir para o Cliente</span>
                                    <ExternalLink size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
