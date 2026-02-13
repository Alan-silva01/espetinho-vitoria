import { useState, useEffect } from 'react'
import {
    Megaphone, Plus, Calendar, Tag,
    MoreVertical, Trash2, Edit2, CheckCircle2,
    Clock, AlertCircle, Eye, Power
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './PromotionsPage.css'

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState([])
    const [loading, setLoading] = useState(true)
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})

    useEffect(() => {
        fetchPromotions()
    }, [])

    async function fetchPromotions() {
        setLoading(true)
        const { data } = await supabase
            .from('promocoes')
            .select('*')
            .order('ordem', { ascending: true })
        if (data) setPromotions(data)
        setLoading(false)
    }

    async function toggleStatus(id, currentStatus) {
        const { error } = await supabase
            .from('promocoes')
            .update({ ativa: !currentStatus })
            .eq('id', id)

        if (!error) fetchPromotions()
    }

    async function toggleDestaque(id, currentDestaque) {
        // If we are setting this as destaque, unset any other destaque first
        if (!currentDestaque) {
            await supabase
                .from('promocoes')
                .update({ destaque: false })
                .neq('id', id)
        }

        const { error } = await supabase
            .from('promocoes')
            .update({ destaque: !currentDestaque })
            .eq('id', id)

        if (!error) fetchPromotions()
    }

    async function deletePromo(id) {
        if (!confirm('Tem certeza que deseja excluir esta promoção?')) return
        const { error } = await supabase
            .from('promocoes')
            .delete()
            .eq('id', id)
        if (!error) fetchPromotions()
    }

    function startEdit(promo) {
        setEditId(promo.id)
        setEditData({ ...promo })
    }

    async function saveEdit() {
        const { error } = await supabase
            .from('promocoes')
            .update({
                titulo: editData.titulo,
                descricao: editData.descricao,
                cor_fundo: editData.cor_fundo,
                cor_texto: editData.cor_texto
            })
            .eq('id', editId)

        if (!error) {
            setEditId(null)
            fetchPromotions()
        }
    }

    return (
        <div className="promotions-page-wrapper animate-fade-in">
            <header className="promotions-header-premium">
                <div className="header-titles">
                    <h1>Marketing & Promoções</h1>
                    <p>Aumente suas vendas com cupons e ofertas irresistíveis.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-add-promo">
                        <Plus size={18} />
                        <span>Criar Promoção</span>
                    </button>
                </div>
            </header>

            <div className="promo-filters-row">
                <button className="filter-chip active">Todas</button>
                <button className="filter-chip">Ativas</button>
                <button className="filter-chip">Arquivadas</button>
            </div>

            <div className="promotions-grid-v2">
                {promotions.map(promo => (
                    <div
                        key={promo.id}
                        className={`promo-card-premium ${promo.ativa ? 'ativo' : 'pausado'}`}
                        style={{ borderLeft: `6px solid ${promo.cor_fundo}` }}
                    >
                        <div className="promo-badge-status">
                            {promo.ativa ? <CheckCircle2 size={12} /> : <Power size={12} />}
                            {promo.ativa ? 'Ativa' : 'Pausada'}
                        </div>

                        {promo.destaque && (
                            <div className="promo-badge-destaque" style={{ background: promo.cor_fundo, color: promo.cor_texto }}>
                                <Tag size={12} />
                                Banner Principal
                            </div>
                        )}

                        <div className="promo-card-header">
                            <div className="discount-circle" style={{ background: promo.cor_fundo }}>
                                <Megaphone size={24} color={promo.cor_texto} />
                            </div>
                            <div className="promo-actions-menu">
                                <button onClick={() => deletePromo(promo.id)}><Trash2 size={18} /></button>
                            </div>
                        </div>

                        <div className="promo-card-body">
                            {editId === promo.id ? (
                                <div className="promo-edit-form">
                                    <input
                                        type="text"
                                        value={editData.titulo}
                                        onChange={e => setEditData({ ...editData, titulo: e.target.value })}
                                        placeholder="Título da Promoção"
                                    />
                                    <textarea
                                        value={editData.descricao}
                                        onChange={e => setEditData({ ...editData, descricao: e.target.value })}
                                        placeholder="Subtítulo / Descrição"
                                    />
                                    <div className="promo-edit-colors">
                                        <label>Fundo: <input type="color" value={editData.cor_fundo} onChange={e => setEditData({ ...editData, cor_fundo: e.target.value })} /></label>
                                        <label>Texto: <input type="color" value={editData.cor_texto} onChange={e => setEditData({ ...editData, cor_texto: e.target.value })} /></label>
                                    </div>
                                    <div className="promo-edit-actions">
                                        <button className="btn-save-edit" onClick={saveEdit}>Salvar</button>
                                        <button className="btn-cancel-edit" onClick={() => setEditId(null)}>Cancelar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h4>{promo.titulo}</h4>
                                    <p className="promo-type">{promo.descricao || 'Sem descrição'}</p>

                                    <div className="promo-colors-preview">
                                        <div className="color-item">
                                            <span style={{ background: promo.cor_fundo }}></span>
                                            <small>Fundo</small>
                                        </div>
                                        <div className="color-item">
                                            <span style={{ background: promo.cor_texto }}></span>
                                            <small>Texto</small>
                                        </div>
                                    </div>
                                    <button className="btn-edit-inline" onClick={() => startEdit(promo)}>
                                        <Edit2 size={14} /> Editar Texto e Cores
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="promo-card-footer">
                            <button
                                className={`btn-destaque-toggle ${promo.destaque ? 'is-destaque' : ''}`}
                                onClick={() => toggleDestaque(promo.id, promo.destaque)}
                            >
                                {promo.destaque ? 'Remover Destaque' : 'Ativar no Banner'}
                            </button>
                            <button
                                className="btn-toggle-promo"
                                onClick={() => toggleStatus(promo.id, promo.ativa)}
                            >
                                {promo.ativa ? 'Pausar' : 'Reativar'}
                            </button>
                        </div>
                    </div>
                ))}

                {/* Create Card placeholder */}
                <button className="add-promo-card-dashed">
                    <div className="icon-circle"><Plus /></div>
                    <span>Nova Promoção</span>
                    <p>Crie banners e ofertas para o app</p>
                </button>
            </div>
        </div>
    )
}
