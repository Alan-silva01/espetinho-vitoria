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
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})
    const [filter, setFilter] = useState('Todas')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newPromo, setNewPromo] = useState({
        titulo: '',
        descricao: '',
        cor_fundo: '#B91C1C',
        cor_texto: '#FFFFFF',
        ativa: true,
        ordem: 1,
        destaque: false,
        preco_promocional: 0,
        itens: [] // array de nomes de produtos
    })

    useEffect(() => {
        fetchPromotions()
        fetchProducts()
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

    async function fetchProducts() {
        const { data } = await supabase
            .from('produtos')
            .select('id, nome, preco')
            .eq('disponivel', true)
        if (data) setProducts(data)
    }

    async function handleCreate(e) {
        e.preventDefault()
        const { error } = await supabase
            .from('promocoes')
            .insert([newPromo])

        if (!error) {
            setIsModalOpen(false)
            setNewPromo({
                titulo: '',
                descricao: '',
                cor_fundo: '#B91C1C',
                cor_texto: '#FFFFFF',
                ativa: true,
                ordem: promotions.length + 1,
                destaque: false,
                preco_promocional: 0,
                itens: []
            })
            fetchPromotions()
        }
    }

    async function toggleStatus(id, currentStatus) {
        const { error } = await supabase
            .from('promocoes')
            .update({ ativa: !currentStatus })
            .eq('id', id)

        if (!error) fetchPromotions()
    }

    async function toggleDestaque(id, currentDestaque) {
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
        setEditData({
            ...promo,
            itens: promo.itens || [],
            preco_promocional: promo.preco_promocional || 0
        })
    }

    async function saveEdit() {
        const { error } = await supabase
            .from('promocoes')
            .update({
                titulo: editData.titulo,
                descricao: editData.descricao,
                cor_fundo: editData.cor_fundo,
                cor_texto: editData.cor_texto,
                itens: editData.itens,
                preco_promocional: editData.preco_promocional
            })
            .eq('id', editId)

        if (!error) {
            setEditId(null)
            fetchPromotions()
        }
    }

    const filteredPromotions = promotions.filter(p => {
        if (filter === 'Ativas') return p.ativa
        if (filter === 'Arquivadas') return !p.ativa
        return true
    })

    const toggleItemInPromo = (state, setState, productName) => {
        const currentItems = state.itens || []
        if (currentItems.includes(productName)) {
            setState({ ...state, itens: currentItems.filter(i => i !== productName) })
        } else {
            setState({ ...state, itens: [...currentItems, productName] })
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
                    <button className="btn-add-promo" onClick={() => setIsModalOpen(true)}>
                        <Plus size={18} />
                        <span>Criar Promoção</span>
                    </button>
                </div>
            </header>

            <div className="promo-filters-row">
                {['Todas', 'Ativas', 'Arquivadas'].map(f => (
                    <button
                        key={f}
                        className={`filter-chip ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="promotions-grid-v2">
                {filteredPromotions.map(promo => (
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

                                    <div className="promo-edit-price">
                                        <label>Preço do Combo (R$):</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editData.preco_promocional}
                                            onChange={e => setEditData({ ...editData, preco_promocional: parseFloat(e.target.value) })}
                                        />
                                    </div>

                                    <div className="promo-edit-products-select">
                                        <label>Produtos incluídos:</label>
                                        <div className="products-scroll-grid">
                                            {products.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className={`product-pill ${editData.itens?.includes(p.nome) ? 'selected' : ''}`}
                                                    onClick={() => toggleItemInPromo(editData, setEditData, p.nome)}
                                                >
                                                    {p.nome}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

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

                                    {promo.preco_promocional > 0 && (
                                        <div className="promo-card-price-tag">
                                            {formatCurrency(promo.preco_promocional)}
                                        </div>
                                    )}

                                    {promo.itens?.length > 0 && (
                                        <div className="promo-card-items-list">
                                            {promo.itens.map(item => (
                                                <span key={item} className="item-tag">{item}</span>
                                            ))}
                                        </div>
                                    )}

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
                                        <Edit2 size={14} /> Editar Texto, Cores e Itens
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
                <button className="add-promo-card-dashed" onClick={() => setIsModalOpen(true)}>
                    <div className="icon-circle"><Plus /></div>
                    <span>Nova Promoção</span>
                    <p>Crie banners e ofertas para o app</p>
                </button>
            </div>

            {/* Creation Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content animate-pop-in">
                        <h2>Nova Promoção</h2>
                        <p>Preencha os dados abaixo para criar uma nova oferta.</p>
                        <form className="modal-form" onSubmit={handleCreate}>
                            <label>
                                Título
                                <input
                                    type="text"
                                    required
                                    value={newPromo.titulo}
                                    onChange={e => setNewPromo({ ...newPromo, titulo: e.target.value })}
                                    placeholder="Ex: Combo Espeto + Bebida"
                                />
                            </label>
                            <label>
                                Descrição / Subtítulo
                                <textarea
                                    value={newPromo.descricao}
                                    onChange={e => setNewPromo({ ...newPromo, descricao: e.target.value })}
                                    placeholder="Ex: Apenas R$ 25,00 - Só hoje!"
                                />
                            </label>

                            <label>
                                Preço do Combo (R$)
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={newPromo.preco_promocional}
                                    onChange={e => setNewPromo({ ...newPromo, preco_promocional: parseFloat(e.target.value) })}
                                />
                            </label>

                            <div className="modal-products-select">
                                <label>Selecione os produtos incluídos:</label>
                                <div className="products-scroll-grid">
                                    {products.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className={`product-pill ${newPromo.itens?.includes(p.nome) ? 'selected' : ''}`}
                                            onClick={() => toggleItemInPromo(newPromo, setNewPromo, p.nome)}
                                        >
                                            {p.nome}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="promo-edit-colors">
                                <label>
                                    Cor do Fundo
                                    <input
                                        type="color"
                                        value={newPromo.cor_fundo}
                                        onChange={e => setNewPromo({ ...newPromo, cor_fundo: e.target.value })}
                                    />
                                </label>
                                <label>
                                    Cor do Texto
                                    <input
                                        type="color"
                                        value={newPromo.cor_texto}
                                        onChange={e => setNewPromo({ ...newPromo, cor_texto: e.target.value })}
                                    />
                                </label>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-close-modal" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="btn-confirm-create">Criar Promoção</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
