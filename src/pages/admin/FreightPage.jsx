import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, X, MapPin, Truck, Search, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './FreightPage.css'

export default function FreightPage() {
    const [loading, setLoading] = useState(true)
    const [freightFees, setFreightFees] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [feedback, setFeedback] = useState({ type: '', msg: '' })

    // Form state
    const [formData, setFormData] = useState({ local: '', valor_frete: '' })
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        fetchFreightFees()
    }, [])

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
