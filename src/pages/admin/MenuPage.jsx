import { useState, useEffect } from 'react'
import {
    Plus, Search, MoreVertical, Edit2,
    Trash2, Image as ImageIcon, Check, X,
    ChevronRight, Filter, Tag, Flame, Award, Settings
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadImage, isCloudinaryConfigured } from '../../lib/cloudinary'
import { formatCurrency } from '../../lib/utils'
import './MenuPage.css'

export default function MenuPage() {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('Todos')
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        preco: '',
        categoria_id: '',
        imagem_url: '',
        disponivel: true,
        item_upsell: false,
        opcoes_personalizacao: []
    })
    const [newOptionText, setNewOptionText] = useState({})
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const { data: catData } = await supabase.from('categorias').select('*').order('nome')
        const { data: prodData } = await supabase
            .from('produtos')
            .select(`
                *,
                categorias(nome)
            `)
            .order('nome')

        setCategories(catData || [])
        setProducts(prodData || [])
        setLoading(false)
    }

    const handleEdit = (product) => {
        setEditingProduct(product)
        setFormData({
            nome: product.nome,
            descricao: product.descricao,
            preco: product.preco,
            categoria_id: product.categoria_id,
            imagem_url: product.imagem_url,
            disponivel: product.disponivel,
            item_upsell: product.item_upsell || false,
            opcoes_personalizacao: product.opcoes_personalizacao || []
        })
        setNewOptionText({})
        setIsModalOpen(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Deseja realmente excluir este produto?')) return
        const { error } = await supabase.from('produtos').delete().eq('id', id)
        if (!error) fetchData()
    }

    const handleUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (!isCloudinaryConfigured) {
            alert('Cloudinary não configurado. Verifique o arquivo .env')
            return
        }

        setUploading(true)
        setUploadProgress(0)
        try {
            const result = await uploadImage(file, {
                folder: 'espetinho-vitoria/produtos',
                onProgress: (pct) => setUploadProgress(pct)
            })
            setFormData(prev => ({ ...prev, imagem_url: result.url }))
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Erro ao enviar imagem: ' + error.message)
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setUploading(true)

        const payload = {
            ...formData,
            preco: parseFloat(formData.preco)
        }

        let error
        if (editingProduct) {
            const { error: err } = await supabase
                .from('produtos')
                .update(payload)
                .eq('id', editingProduct.id)
            error = err
        } else {
            const { error: err } = await supabase
                .from('produtos')
                .insert([payload])
            error = err
        }

        if (!error) {
            setIsModalOpen(false)
            setEditingProduct(null)
            setFormData({
                nome: '',
                descricao: '',
                preco: '',
                categoria_id: '',
                imagem_url: '',
                disponivel: true,
                item_upsell: false,
                opcoes_personalizacao: []
            })
            setNewOptionText({})
            fetchData()
        } else {
            alert('Erro ao salvar produto: ' + error.message)
        }
        setUploading(false)
    }

    // --- Customization Group Management ---
    const addGroup = () => {
        setFormData(prev => ({
            ...prev,
            opcoes_personalizacao: [
                ...prev.opcoes_personalizacao,
                { grupo: '', tipo: 'checkbox', opcoes: [] }
            ]
        }))
    }

    const removeGroup = (idx) => {
        setFormData(prev => ({
            ...prev,
            opcoes_personalizacao: prev.opcoes_personalizacao.filter((_, i) => i !== idx)
        }))
    }

    const updateGroup = (idx, field, value) => {
        setFormData(prev => {
            const updated = [...prev.opcoes_personalizacao]
            updated[idx] = { ...updated[idx], [field]: value }
            return { ...prev, opcoes_personalizacao: updated }
        })
    }

    const addOptionToGroup = (gIdx) => {
        const text = (newOptionText[gIdx] || '').trim()
        if (!text) return
        setFormData(prev => {
            const updated = [...prev.opcoes_personalizacao]
            updated[gIdx] = { ...updated[gIdx], opcoes: [...updated[gIdx].opcoes, text] }
            return { ...prev, opcoes_personalizacao: updated }
        })
        setNewOptionText(prev => ({ ...prev, [gIdx]: '' }))
    }

    const removeOptionFromGroup = (gIdx, oIdx) => {
        setFormData(prev => {
            const updated = [...prev.opcoes_personalizacao]
            updated[gIdx] = { ...updated[gIdx], opcoes: updated[gIdx].opcoes.filter((_, i) => i !== oIdx) }
            return { ...prev, opcoes_personalizacao: updated }
        })
    }

    const handleToggleDisponivel = async (product) => {
        const { error } = await supabase
            .from('produtos')
            .update({ disponivel: !product.disponivel })
            .eq('id', product.id)

        if (!error) fetchData()
    }

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === 'Todos' || p.categorias?.nome === selectedCategory
        return matchesSearch && matchesCategory
    })

    if (loading) return <div className="admin-loading">Carregando cardápio...</div>

    return (
        <div className="menu-page-wrapper animate-fade-in">
            <header className="menu-header-premium">
                <div className="header-left">
                    <h1>Gestão de Cardápio</h1>
                    <p>Gerencie seus produtos, preços e disponibilidade.</p>
                </div>
                <div className="header-right">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn-add-product" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} />
                        <span>Novo Produto</span>
                    </button>
                </div>
            </header>

            <div className="menu-filters-pills">
                <button
                    className={`filter-pill ${selectedCategory === 'Todos' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('Todos')}
                >
                    Todos
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={`filter-pill ${selectedCategory === cat.nome ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.nome)}
                    >
                        {cat.nome}
                    </button>
                ))}
            </div>

            <div className="products-grid-premium">
                {filteredProducts.map(p => (
                    <div key={p.id} className={`product-card-premium ${!p.disponivel ? 'out-of-stock' : ''}`}>
                        <div className="product-card__img">
                            <img src={p.imagem_url || 'https://via.placeholder.com/300x200'} alt={p.nome} />
                            <div className="card-actions-overlay">
                                <button className="circle-btn" onClick={() => handleEdit(p)}><Edit2 size={14} /></button>
                                <button className="circle-btn delete" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                            </div>
                            {p.item_upsell && <span className="badge-promo"><Award size={12} /> Sugestão</span>}
                            {!p.disponivel && <div className="out-overlay">Esgotado</div>}
                        </div>
                        <div className="product-card__body">
                            <div className="card-top">
                                <h3 className="product-name">{p.nome}</h3>
                                <div className="status-toggle" onClick={() => handleToggleDisponivel(p)}>
                                    <div className={`toggle-track ${p.disponivel ? 'on' : 'off'}`}>
                                        <div className="toggle-thumb" />
                                    </div>
                                </div>
                            </div>
                            <p className="product-desc">{p.descricao}</p>
                            <div className="card-bottom">
                                <div className="price-tag">
                                    <span className="label">Preço</span>
                                    <span className="value">{formatCurrency(p.preco)}</span>
                                </div>
                                <span className="cat-label">{p.categorias?.nome}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Produto */}
            {isModalOpen && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-card animate-scale-in">
                        <div className="modal-header">
                            <h2>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="modal-form">
                            <div className="form-grid">
                                <div className="form-left">
                                    <div className="image-upload-box">
                                        {formData.imagem_url ? (
                                            <div className="preview-container">
                                                <img src={formData.imagem_url} alt="Preview" />
                                                <button type="button" className="remove-img" onClick={() => setFormData(prev => ({ ...prev, imagem_url: '' }))}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="upload-placeholder">
                                                <ImageIcon size={32} />
                                                <span>Clique para enviar imagem</span>
                                                <input type="file" hidden onChange={handleUpload} accept="image/*" />
                                            </label>
                                        )}
                                        {uploading && <div className="upload-loader">Enviando... {uploadProgress}%</div>}
                                    </div>

                                    <div className="input-group-premium">
                                        <label>Sugestão de Venda?</label>
                                        <div className="checkbox-wrapper">
                                            <input
                                                type="checkbox"
                                                id="upsell"
                                                checked={formData.item_upsell}
                                                onChange={e => setFormData(prev => ({ ...prev, item_upsell: e.target.checked }))}
                                            />
                                            <label htmlFor="upsell">Aparecer em "Você também pode gostar"</label>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-right">
                                    <div className="input-group-premium">
                                        <label>Nome do Produto</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.nome}
                                            onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                                            placeholder="Ex: Espetinho de Picanha"
                                        />
                                    </div>

                                    <div className="input-row">
                                        <div className="input-group-premium">
                                            <label>Categoria</label>
                                            <select
                                                required
                                                value={formData.categoria_id}
                                                onChange={e => setFormData(prev => ({ ...prev, categoria_id: e.target.value }))}
                                            >
                                                <option value="">Selecione...</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="input-group-premium">
                                            <label>Preço (R$)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={formData.preco}
                                                onChange={e => setFormData(prev => ({ ...prev, preco: e.target.value }))}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group-premium">
                                        <label>Descrição</label>
                                        <textarea
                                            value={formData.descricao}
                                            onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                                            placeholder="Descreva os detalhes do produto..."
                                            rows={4}
                                        />
                                    </div>

                                    {/* Customization Options Editor */}
                                    <div className="input-group-premium">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <label style={{ margin: 0 }}>
                                                <Settings size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                                                Opções de Personalização
                                            </label>
                                            <button
                                                type="button"
                                                className="btn-add-group"
                                                onClick={addGroup}
                                            >
                                                <Plus size={14} /> Adicionar Grupo
                                            </button>
                                        </div>

                                        {formData.opcoes_personalizacao.length === 0 && (
                                            <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                                                Nenhuma opção ainda. Adicione grupos como "Acompanhamento" ou "Ponto da Carne".
                                            </p>
                                        )}

                                        {formData.opcoes_personalizacao.map((group, gIdx) => (
                                            <div key={gIdx} className="custom-group-editor">
                                                <div className="custom-group-editor__header">
                                                    <input
                                                        type="text"
                                                        placeholder="Nome do grupo (ex: Acompanhamento)"
                                                        value={group.grupo}
                                                        onChange={e => updateGroup(gIdx, 'grupo', e.target.value)}
                                                        className="custom-group-editor__name"
                                                    />
                                                    <select
                                                        value={group.tipo}
                                                        onChange={e => updateGroup(gIdx, 'tipo', e.target.value)}
                                                        className="custom-group-editor__type"
                                                    >
                                                        <option value="checkbox">Múltipla escolha</option>
                                                        <option value="radio">Escolha única</option>
                                                    </select>
                                                    <button type="button" className="custom-group-editor__remove" onClick={() => removeGroup(gIdx)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                <div className="custom-group-editor__options">
                                                    {group.opcoes.map((opt, oIdx) => (
                                                        <span key={oIdx} className="custom-option-tag">
                                                            {opt}
                                                            <button type="button" onClick={() => removeOptionFromGroup(gIdx, oIdx)}>
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="custom-group-editor__add-row">
                                                    <input
                                                        type="text"
                                                        placeholder="Nova opção..."
                                                        value={newOptionText[gIdx] || ''}
                                                        onChange={e => setNewOptionText(prev => ({ ...prev, [gIdx]: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOptionToGroup(gIdx) } }}
                                                    />
                                                    <button type="button" onClick={() => addOptionToGroup(gIdx)}>
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="modal-actions">
                                        <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                        <button type="submit" className="btn-primary-admin" disabled={uploading}>
                                            {uploading ? 'Salvando...' : 'Salvar Produto'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quick Stats footer as in reference */}
            <div className="menu-pagination-bar">
                <p>Mostrando <strong>{filteredProducts.length}</strong> produtos</p>
                <div className="pagination-btns">
                    <button disabled>Anterior</button>
                    <button disabled>Próximo</button>
                </div>
            </div>
        </div>
    )
}
