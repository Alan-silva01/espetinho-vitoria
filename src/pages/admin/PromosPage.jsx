import { useState, useEffect } from 'react'
import {
    Plus, Edit3, Trash2, X, Save, AlertCircle, Check,
    GripVertical, Eye, EyeOff, Palette, Megaphone
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './PromosPage.css'

const PRESET_COLORS = [
    { bg: '#C41E2E', text: '#FFFFFF', label: 'Vermelho' },
    { bg: '#7C3AED', text: '#FFFFFF', label: 'Roxo' },
    { bg: '#059669', text: '#FFFFFF', label: 'Verde' },
    { bg: '#D97706', text: '#FFFFFF', label: 'Laranja' },
    { bg: '#2563EB', text: '#FFFFFF', label: 'Azul' },
    { bg: '#111827', text: '#FFFFFF', label: 'Preto' },
    { bg: '#FDE68A', text: '#111827', label: 'Amarelo' },
    { bg: '#FFF1F2', text: '#C41E2E', label: 'Rose' },
]

export default function PromosPage() {
    const [promos, setPromos] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(null) // null | { type: 'add'|'edit', promo? }
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [toast, setToast] = useState(null)

    useEffect(() => { fetchPromos() }, [])

    async function fetchPromos() {
        setLoading(true)
        const { data } = await supabase
            .from('promocoes')
            .select('*')
            .order('ordem')
        setPromos(data || [])
        setLoading(false)
    }

    function showToast(msg, type = 'success') {
        setToast({ message: msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    async function toggleAtiva(id, current) {
        const { error } = await supabase.from('promocoes').update({ ativa: !current }).eq('id', id)
        if (!error) {
            setPromos(prev => prev.map(p => p.id === id ? { ...p, ativa: !current } : p))
        }
    }

    async function handleDelete(id) {
        const { error } = await supabase.from('promocoes').delete().eq('id', id)
        if (!error) {
            setPromos(prev => prev.filter(p => p.id !== id))
            showToast('Promoção excluída')
        }
        setDeleteConfirm(null)
    }

    return (
        <div className="admin-promos">
            <div className="admin-promos__header">
                <div>
                    <h1>Promoções & Banners</h1>
                    <p>{promos.length} promoções cadastradas • Aparece no marquee da home</p>
                </div>
                <button className="admin-btn admin-btn--primary" onClick={() => setModal({ type: 'add' })}>
                    <Plus size={18} />
                    Nova Promoção
                </button>
            </div>

            {loading ? (
                <div className="admin-loading">Carregando...</div>
            ) : (
                <div className="promos-grid">
                    {promos.map(promo => (
                        <div key={promo.id} className="promo-card">
                            <div
                                className="promo-card__banner"
                                style={{ background: promo.cor_fundo, color: promo.cor_texto }}
                            >
                                <p className="promo-card__text">{promo.titulo}</p>
                                {promo.descricao && (
                                    <p className="promo-card__desc">{promo.descricao}</p>
                                )}
                            </div>
                            <div className="promo-card__footer">
                                <div className="promo-card__status">
                                    <button
                                        className={`admin-toggle ${promo.ativa ? 'admin-toggle--on' : ''}`}
                                        onClick={() => toggleAtiva(promo.id, promo.ativa)}
                                    >
                                        <span className="admin-toggle__dot" />
                                        <span>{promo.ativa ? 'Ativa' : 'Inativa'}</span>
                                    </button>
                                </div>
                                <div className="promo-card__actions">
                                    <button
                                        className="admin-action-btn"
                                        onClick={() => setModal({ type: 'edit', promo })}
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        className="admin-action-btn admin-action-btn--danger"
                                        onClick={() => setDeleteConfirm(promo)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {promos.length === 0 && (
                        <div className="admin-empty" style={{ gridColumn: '1/-1' }}>
                            <Megaphone size={40} strokeWidth={1.5} style={{ marginBottom: 12 }} />
                            <p>Nenhuma promoção cadastrada</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Add/Edit */}
            {modal && (
                <PromoModal
                    type={modal.type}
                    promo={modal.promo}
                    onClose={() => setModal(null)}
                    onSave={() => {
                        setModal(null)
                        fetchPromos()
                        showToast(modal.type === 'add' ? 'Promoção criada!' : 'Promoção atualizada!')
                    }}
                />
            )}

            {/* Modal de Confirmação de Exclusão */}
            {deleteConfirm && (
                <div className="admin-modal-overlay">
                    <div className="modal-confirm-delete animate-scale-in">
                        <div className="confirm-icon-box">
                            <Trash2 size={32} />
                        </div>
                        <h2>Excluir Promoção?</h2>
                        <p>Tem certeza que deseja excluir a promoção <strong>"{deleteConfirm.titulo}"</strong>? Esta ação não pode ser desfeita.</p>

                        <div className="confirm-actions">
                            <button
                                className="btn-confirm-cancel"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-confirm-delete"
                                onClick={() => handleDelete(deleteConfirm.id)}
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`admin-toast admin-toast--${toast.type}`}>
                    {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}
        </div>
    )
}

/* ===== Promo Modal ===== */
function PromoModal({ type, promo, onClose, onSave }) {
    const [form, setForm] = useState({
        titulo: promo?.titulo || '',
        descricao: promo?.descricao || '',
        cor_fundo: promo?.cor_fundo || '#C41E2E',
        cor_texto: promo?.cor_texto || '#FFFFFF',
        link: promo?.link || '',
        ativa: promo?.ativa ?? true,
        ordem: promo?.ordem || 0,
    })
    const [saving, setSaving] = useState(false)

    function handleChange(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.titulo) {
            alert('Preencha o título da promoção')
            return
        }

        setSaving(true)
        let error
        if (type === 'add') {
            ; ({ error } = await supabase.from('promocoes').insert(form))
        } else {
            ; ({ error } = await supabase.from('promocoes').update(form).eq('id', promo.id))
        }

        setSaving(false)
        if (error) {
            alert('Erro ao salvar: ' + error.message)
        } else {
            onSave()
        }
    }

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <div className="admin-modal__header">
                    <h2>{type === 'add' ? 'Nova Promoção' : 'Editar Promoção'}</h2>
                    <button className="admin-modal__close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form className="admin-modal__form" onSubmit={handleSubmit}>
                    {/* Preview */}
                    <div className="admin-form-group">
                        <label>Preview do Banner</label>
                        <div
                            className="promo-preview"
                            style={{ background: form.cor_fundo, color: form.cor_texto }}
                        >
                            {form.titulo || 'Texto da promoção aqui...'}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="admin-form-group">
                        <label>Texto da Promoção *</label>
                        <input
                            type="text"
                            className="admin-input"
                            placeholder="🔥 Combo Casal: 2 Espetos + 1 Açaí por R$ 25"
                            value={form.titulo}
                            onChange={e => handleChange('titulo', e.target.value)}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="admin-form-group">
                        <label>Descrição (opcional)</label>
                        <input
                            type="text"
                            className="admin-input"
                            placeholder="Detalhes adicionais..."
                            value={form.descricao}
                            onChange={e => handleChange('descricao', e.target.value)}
                        />
                    </div>

                    {/* Colors */}
                    <div className="admin-form-group">
                        <label><Palette size={14} /> Cor do Banner</label>
                        <div className="color-palette">
                            {PRESET_COLORS.map((c, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`color-swatch ${form.cor_fundo === c.bg ? 'color-swatch--active' : ''}`}
                                    style={{ background: c.bg, color: c.text }}
                                    onClick={() => {
                                        handleChange('cor_fundo', c.bg)
                                        handleChange('cor_texto', c.text)
                                    }}
                                    title={c.label}
                                >
                                    {form.cor_fundo === c.bg && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                        {/* Custom color */}
                        <div className="color-custom">
                            <label>Cor personalizada:</label>
                            <input
                                type="color"
                                value={form.cor_fundo}
                                onChange={e => handleChange('cor_fundo', e.target.value)}
                            />
                            <span>{form.cor_fundo}</span>
                        </div>
                    </div>

                    {/* Link */}
                    <div className="admin-form-group">
                        <label>Link (opcional)</label>
                        <input
                            type="text"
                            className="admin-input"
                            placeholder="/produto/abc123 ou URL externa"
                            value={form.link}
                            onChange={e => handleChange('link', e.target.value)}
                        />
                    </div>

                    {/* Order + Active */}
                    <div className="admin-form-row">
                        <div className="admin-form-group">
                            <label>Ordem</label>
                            <input
                                type="number"
                                className="admin-input"
                                value={form.ordem}
                                onChange={e => handleChange('ordem', parseInt(e.target.value) || 0)}
                                min="0"
                            />
                        </div>
                        <div className="admin-form-group" style={{ justifyContent: 'flex-end' }}>
                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    checked={form.ativa}
                                    onChange={e => handleChange('ativa', e.target.checked)}
                                />
                                <span>Promoção ativa</span>
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="admin-modal__actions">
                        <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                            <Save size={16} />
                            {saving ? 'Salvando...' : (type === 'add' ? 'Criar Promoção' : 'Salvar')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
