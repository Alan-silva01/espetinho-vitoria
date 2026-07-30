import { useState, useEffect } from 'react'
import {
    Search, User, Phone, MapPin, X, ExternalLink, UserPlus, Sparkles, ArrowRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
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

    // Reset ao abrir/fechar
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('')
            setCustomerResults([])
            setSelectedCustomer(null)
            setIsCreatingNew(false)
            setNewName('')
            setNewPhone('')
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
                        .select('id, codigo, nome, telefone, dados')
                        .or(`nome.ilike.%${term}%,codigo.ilike.%${term}%,telefone.ilike.%${digitsOnly}%,dados->>whatsapp.ilike.%${digitsOnly}%`)
                        .order('criado_em', { ascending: false })
                        .limit(50)
                    rawData = data || []
                } else {
                    const { data } = await supabase
                        .from('clientes')
                        .select('id, codigo, nome, telefone, dados')
                        .or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`)
                        .limit(30)
                    rawData = data || []
                }

                // Fallback: if searching by phone digits and OR query yielded 0 results, fetch recent clients to filter in JS
                if (rawData.length === 0 && digitsOnly.length >= 4) {
                    const { data: fallbackData } = await supabase
                        .from('clientes')
                        .select('id, codigo, nome, telefone, dados')
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

            const payload = {
                nome: newName.trim(),
                telefone: rawPhone,
                codigo: generatedCode,
                dados: {
                    nome: newName.trim(),
                    whatsapp: rawPhone
                }
            }

            const { data, error } = await supabase
                .from('clientes')
                .insert([payload])
                .select()
                .single()

            if (error) throw error

            handleOpenCustomerApp(data)
        } catch (err) {
            alert('Erro ao cadastrar cliente: ' + err.message)
        } finally {
            setIsSubmittingNew(false)
        }
    }

    return (
        <div className="create-order-overlay" onClick={onClose}>
            <div className="create-order-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                {/* Cabeçalho */}
                <div className="create-order-header">
                    <div>
                        <h2>⚡ Novo Pedido para Cliente</h2>
                        <p>Selecione o cliente para abrir o cardápio pré-identificado com os dados dele</p>
                    </div>
                    <button className="btn-close-modal" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="create-order-body" style={{ padding: '20px' }}>
                    {!isCreatingNew ? (
                        <div className="section-box">
                            <h3><User size={18} /> Buscar Cliente Existente</h3>

                            <div className="search-input-wrapper" style={{ marginTop: '10px' }}>
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Digite o Nome ou WhatsApp do cliente..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {searchingCustomers && (
                                <div className="searching-spinner" style={{ margin: '14px 0', fontSize: '13px', color: '#64748B' }}>
                                    Buscando na lista de clientes...
                                </div>
                            )}

                            {customerResults.length > 0 && (
                                <div className="customer-results-list" style={{ marginTop: '12px', maxHeight: '240px' }}>
                                    {customerResults.map(c => (
                                        <div
                                            key={c.id}
                                            className="customer-result-item"
                                            onClick={() => handleOpenCustomerApp(c)}
                                        >
                                            <div className="cust-info">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <strong>{c.nome}</strong>
                                                    <span style={{ fontSize: '11px', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', color: '#475569', fontWeight: '700' }}>
                                                        {c.codigo}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '12px', color: '#64748B' }}>
                                                    <Phone size={12} /> {c.telefone || c.dados?.whatsapp || 'Sem telefone'}
                                                </span>
                                            </div>
                                            <button className="btn-select-cust" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Abrir App <ExternalLink size={14} />
                                            </button>
                                        </div>
                                    ))}
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
                                    placeholder="Ex: (99) 99999-9999"
                                    value={newPhone}
                                    onChange={e => setNewPhone(e.target.value)}
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
                                    {isSubmittingNew ? 'Criando...' : <>Criar & Abrir App <ArrowRight size={16} /></>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
