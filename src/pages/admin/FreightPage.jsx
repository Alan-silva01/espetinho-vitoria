import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, X, MapPin, Truck, Search, AlertCircle, CheckCircle2, CreditCard, Percent, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './FreightPage.css'

export default function FreightPage() {
    const [loading, setLoading] = useState(true)
    const [freightFees, setFreightFees] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [feedback, setFeedback] = useState({ type: '', msg: '' })

    // Card fees state (from configuracoes_loja)
    const [taxaCredito, setTaxaCredito] = useState('5.0')
    const [taxaDebito, setTaxaDebito] = useState('5.0')
    const [savingCardFees, setSavingCardFees] = useState(false)

    // Form state
    const [formData, setFormData] = useState({ local: '', valor_frete: '' })
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        fetchFreightFees()
        fetchCardFees()
    }, [])

    async function fetchCardFees() {
        try {
            const { data, error } = await supabase
                .from('configuracoes_loja')
                .select('taxa_cartao_credito, taxa_cartao_debito')
                .single()
            if (error) throw error
            if (data) {
                if (data.taxa_cartao_credito !== null && data.taxa_cartao_credito !== undefined) {
                    setTaxaCredito(String(data.taxa_cartao_credito))
                }
                if (data.taxa_cartao_debito !== null && data.taxa_cartao_debito !== undefined) {
                    setTaxaDebito(String(data.taxa_cartao_debito))
                }
            }
        } catch (err) {
            console.error('Erro ao buscar taxas de cartão:', err)
        }
    }

    async function handleSaveCardFees(e) {
        e.preventDefault()
        const cred = parseFloat(taxaCredito)
        const deb = parseFloat(taxaDebito)
        if (isNaN(cred) || cred < 0 || isNaN(deb) || deb < 0) {
            showFeedback('error', 'Informe porcentagens válidas para as taxas de cartão')
            return
        }

        setSavingCardFees(true)
        try {
            const { data: storeConfig } = await supabase
                .from('configuracoes_loja')
                .select('id')
                .single()

            if (!storeConfig?.id) throw new Error('Configuração da loja não encontrada')

            const { error } = await supabase
                .from('configuracoes_loja')
                .update({
                    taxa_cartao_credito: cred,
                    taxa_cartao_debito: deb
                })
                .eq('id', storeConfig.id)

            if (error) throw error
            showFeedback('success', 'Taxas de cartão atualizadas com sucesso!')
        } catch (err) {
            console.error('Erro ao salvar taxas de cartão:', err)
            showFeedback('error', 'Erro ao salvar taxas: ' + err.message)
        } finally {
            setSavingCardFees(false)
        }
    }

    async function fetchFreightFees() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('taxas_entrega')
                .select('*')
                .order('local')
            if (error) throw error
            setFreightFees(data || [])

        } catch (err) {
            console.error('Erro ao buscar fretes:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredFees = freightFees.filter(f =>
        f.local.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const showFeedback = (type, msg) => {
        setFeedback({ type, msg })
        setTimeout(() => setFeedback({ type: '', msg: '' }), 3000)
    }

    async function handleSave() {
        if (!formData.local || !formData.valor_frete) {
            showFeedback('error', 'Preencha todos os campos')
            return
        }

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('taxas_entrega')
                    .update({
                        local: formData.local,
                        valor_frete: parseFloat(formData.valor_frete)
                    })
                    .eq('id', editingId)
                if (error) throw error
                showFeedback('success', 'Bairro atualizado!')
            } else {
                const { error } = await supabase
                    .from('taxas_entrega')
                    .insert([{
                        local: formData.local,
                        valor_frete: parseFloat(formData.valor_frete)
                    }])
                if (error) throw error
                showFeedback('success', 'Bairro adicionado!')
            }

            setFormData({ local: '', valor_frete: '' })
            setEditingId(null)
            setIsAdding(false)
            fetchFreightFees()
        } catch (err) {
            showFeedback('error', err.message)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Tem certeza que deseja excluir esta taxa de entrega?')) return
        try {
            const { error } = await supabase.from('taxas_entrega').delete().eq('id', id)
            if (error) throw error
            showFeedback('success', 'Bairro removido!')
            fetchFreightFees()
        } catch (err) {
            showFeedback('error', err.message)
        }
    }

    const startEdit = (fee) => {
        setEditingId(fee.id)
        setFormData({ local: fee.local, valor_frete: fee.valor_frete })
        setIsAdding(true)
    }

    return (
        <div className="freight-page animate-fade-in">
            <header className="freight-header">
                <div className="freight-header__info">
                    <h1>Taxas de Entrega</h1>
                    <p>Gerencie os valores de frete por bairro de forma independente.</p>
                </div>

                <div className="freight-header__actions">
                    {feedback.msg && (
                        <div className={`feedback-pill ${feedback.type}`}>
                            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span>{feedback.msg}</span>
                        </div>
                    )}
                    <button className="btn-add-premium" onClick={() => {
                        setIsAdding(true)
                        setEditingId(null)
                        setFormData({ local: '', valor_frete: '' })
                    }}>
                        <Plus size={20} />
                        <span>Novo Bairro</span>
                    </button>
                </div>
            </header>

            {/* CARD FEES CONFIGURATION SECTION */}
            <section className="card-fees-section">
                <div className="card-fees-card">
                    <div className="card-fees-header">
                        <div className="card-fees-title">
                            <CreditCard size={18} color="#C41E2E" />
                            <div>
                                <h3>Taxas da Maquininha de Cartão</h3>
                                <p>Defina a porcentagem de acréscimo cobrada no checkout para pagamentos em cartão.</p>
                            </div>
                        </div>
                    </div>

                    <form className="card-fees-form" onSubmit={handleSaveCardFees}>
                        <div className="card-fees-inputs">
                            <div className="card-fee-input-group">
                                <label>Crédito (%)</label>
                                <div className="card-fee-field">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={taxaCredito}
                                        onChange={e => setTaxaCredito(e.target.value)}
                                        placeholder="Ex: 5"
                                        required
                                    />
                                    <span className="fee-symbol">%</span>
                                </div>
                            </div>

                            <div className="card-fee-input-group">
                                <label>Débito (%)</label>
                                <div className="card-fee-field">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={taxaDebito}
                                        onChange={e => setTaxaDebito(e.target.value)}
                                        placeholder="Ex: 5"
                                        required
                                    />
                                    <span className="fee-symbol">%</span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-save-card-fees"
                            disabled={savingCardFees}
                        >
                            <Save size={16} />
                            <span>{savingCardFees ? 'Salvando...' : 'Salvar Taxas'}</span>
                        </button>
                    </form>
                </div>
            </section>

            <div className="freight-controls">
                <div className="search-box-premium">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Buscar bairro..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="freight-stats">
                    <div className="stat-item">
                        <span className="stat-value">{freightFees.length}</span>
                        <span className="stat-label">Bairros</span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="freight-loading">
                    <div className="spinner" />
                    <p>Carregando taxas...</p>
                </div>
            ) : (
                <div className="freight-grid">
                    {filteredFees.length === 0 ? (
                        <div className="freight-empty">
                            <Truck size={48} />
                            <h3>Nenhum bairro encontrado</h3>
                            <p>Adicione novos locais para começar a cobrar frete por região.</p>
                        </div>
                    ) : (
                        filteredFees.map(fee => (
                            <div key={fee.id} className="freight-card-premium animate-slide-up">
                                <div className="freight-card-premium__icon">
                                    <MapPin size={24} />
                                </div>
                                <div className="freight-card-premium__content">
                                    <h3>{fee.local}</h3>
                                    <div className="freight-card-premium__price">
                                        <span>Frete:</span>
                                        <strong>{formatCurrency(fee.valor_frete)}</strong>
                                    </div>
                                </div>
                                <div className="freight-card-premium__actions">
                                    <button className="btn-icon-premium" onClick={() => startEdit(fee)}>
                                        <Edit3 size={18} />
                                    </button>
                                    <button className="btn-icon-premium delete" onClick={() => handleDelete(fee.id)}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {isAdding && (
                <div className="freight-modal-overlay" onClick={() => setIsAdding(false)}>
                    <div className="freight-modal animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="freight-modal__header">
                            <h2>{editingId ? 'Editar Bairro' : 'Novo Bairro'}</h2>
                            <button className="btn-close-modal" onClick={() => setIsAdding(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="freight-modal__body">
                            <div className="input-group-premium">
                                <label>Nome do Bairro</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Centro"
                                    value={formData.local}
                                    onChange={e => setFormData({ ...formData, local: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="input-group-premium">
                                <label>Valor do Frete (R$)</label>
                                <div className="input-with-symbol">
                                    <span>R$</span>
                                    <input
                                        type="number"
                                        step="0.50"
                                        placeholder="0,00"
                                        value={formData.valor_frete}
                                        onChange={e => setFormData({ ...formData, valor_frete: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="freight-modal__footer">
                            <button className="btn-secondary-premium" onClick={() => setIsAdding(false)}>Cancelar</button>
                            <button className="btn-primary-premium" onClick={handleSave}>
                                {editingId ? 'Salvar Alterações' : 'Adicionar Local'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
