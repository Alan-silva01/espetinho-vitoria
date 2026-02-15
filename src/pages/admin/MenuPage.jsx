import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
        quantidade_disponivel: 0,
        controlar_estoque: false,
        opcoes_personalizacao: []
    })
    const [newOptionText, setNewOptionText] = useState({})
    const [newOptionPrice, setNewOptionPrice] = useState({})
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    // Variations state
    const [variations, setVariations] = useState([])
    const [deletedVariationIds, setDeletedVariationIds] = useState([])
    const [newVarName, setNewVarName] = useState('')
    const [newVarPrice, setNewVarPrice] = useState('')

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, loading: false, error: null })

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
                categorias(nome),
                variacoes_produto(*)
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
            quantidade_disponivel: product.quantidade_disponivel || 0,
            controlar_estoque: product.controlar_estoque || false,
            opcoes_personalizacao: product.opcoes_personalizacao || []
        })
        setVariations((product.variacoes_produto || []).map(v => ({ ...v })))
        setDeletedVariationIds([])
        setNewVarName('')
        setNewVarPrice('')
        setNewOptionText({})
        setNewOptionPrice({})
        setIsModalOpen(true)
    }

    const handleDelete = async (id) => {
        setDeleteConfirm({ open: true, id, loading: false, error: null })
    }

    const confirmDelete = async () => {
        setDeleteConfirm(prev => ({ ...prev, loading: true, error: null }))

        try {
            const { error } = await supabase.from('produtos').delete().eq('id', deleteConfirm.id)

            if (error) {
                if (error.code === '23503') {
                    throw new Error('Este produto não pode ser excluído pois já existem pedidos vinculados a ele. Você pode desativar o produto para que ele não apareça mais no cardápio.')
                }
                throw error
            }

            setDeleteConfirm({ open: false, id: null, loading: false, error: null })
            fetchData()
        } catch (err) {
            setDeleteConfirm(prev => ({ ...prev, loading: false, error: err.message }))
        }
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
            preco: parseFloat(formData.preco),
            quantidade_disponivel: parseInt(formData.quantidade_disponivel) || 0
        }

        let error
        let productId = editingProduct?.id
        if (editingProduct) {
            const { error: err } = await supabase
                .from('produtos')
                .update(payload)
                .eq('id', editingProduct.id)
            error = err
        } else {
            const { data: newProd, error: err } = await supabase
                .from('produtos')
                .insert([payload])
                .select('id')
                .single()
            error = err
            if (newProd) productId = newProd.id
        }

        if (!error && productId) {
            // --- Save variations ---
            // Delete removed variations
            if (deletedVariationIds.length > 0) {
                await supabase.from('variacoes_produto').delete().in('id', deletedVariationIds)
            }
            // Upsert variations
            for (const v of variations) {
                const varPayload = {
                    produto_id: productId,
                    nome: v.nome,
                    preco: parseFloat(v.preco) || 0,
                    disponivel: v.disponivel !== false,
                    imagem_url: v.imagem_url || null,
                }
                if (v.id && typeof v.id === 'string' && !v.id.startsWith('new-')) {
                    // Existing variation — update
                    await supabase.from('variacoes_produto').update(varPayload).eq('id', v.id)
                } else {
                    // New variation — insert
                    await supabase.from('variacoes_produto').insert([varPayload])
                }
            }
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
                quantidade_disponivel: 0,
                controlar_estoque: false,
                opcoes_personalizacao: []
            })
            setVariations([])
            setDeletedVariationIds([])
            setNewVarName('')
            setNewVarPrice('')
            setNewOptionText({})
            setNewOptionPrice({})
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
        const price = parseFloat(newOptionPrice[gIdx] || '0') || 0
        const newOpt = { nome: text, preco: price, imagem_url: '' }
        setFormData(prev => {
            const updated = [...prev.opcoes_personalizacao]
            updated[gIdx] = { ...updated[gIdx], opcoes: [...updated[gIdx].opcoes, newOpt] }
            return { ...prev, opcoes_personalizacao: updated }
        })
        setNewOptionText(prev => ({ ...prev, [gIdx]: '' }))
        setNewOptionPrice(prev => ({ ...prev, [gIdx]: '' }))
    }

    const removeOptionFromGroup = (gIdx, oIdx) => {
        setFormData(prev => {
            const updated = [...prev.opcoes_personalizacao]
            updated[gIdx] = { ...updated[gIdx], opcoes: updated[gIdx].opcoes.filter((_, i) => i !== oIdx) }
            return { ...prev, opcoes_personalizacao: updated }
        })
    }

    const handleOptionImageUpload = async (gIdx, oIdx, file) => {
        if (!file || !isCloudinaryConfigured) return
        try {
            const result = await uploadImage(file, { folder: 'espetinho-vitoria/opcoes' })
            setFormData(prev => {
                const updated = [...prev.opcoes_personalizacao]
                const opcoes = [...updated[gIdx].opcoes]
                const opt = typeof opcoes[oIdx] === 'string'
                    ? { nome: opcoes[oIdx], preco: 0, imagem_url: result.url }
                    : { ...opcoes[oIdx], imagem_url: result.url }
                opcoes[oIdx] = opt
                updated[gIdx] = { ...updated[gIdx], opcoes }
                return { ...prev, opcoes_personalizacao: updated }
            })
        } catch (err) {
            alert('Erro no upload: ' + err.message)
        }
    }

    // --- Variation Management ---
    const addVariation = () => {
        const name = newVarName.trim()
        if (!name) return
        setVariations(prev => [
            ...prev,
            { id: `new-${Date.now()}`, nome: name, preco: parseFloat(newVarPrice) || 0, disponivel: true, imagem_url: '' }
        ])
        setNewVarName('')
        setNewVarPrice('')
    }

    const removeVariation = (idx) => {
        const v = variations[idx]
        if (v.id && typeof v.id === 'string' && !v.id.startsWith('new-')) {
            setDeletedVariationIds(prev => [...prev, v.id])
        }
        setVariations(prev => prev.filter((_, i) => i !== idx))
    }

    const updateVariation = (idx, field, value) => {
        setVariations(prev => {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], [field]: value }
            return updated
        })
    }

    const handleVariationImageUpload = async (idx, file) => {
        if (!file || !isCloudinaryConfigured) return
        try {
            const result = await uploadImage(file, { folder: 'espetinho-vitoria/variacoes' })
            updateVariation(idx, 'imagem_url', result.url)
        } catch (err) {
            alert('Erro no upload: ' + err.message)
        }
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
                    <button className="btn-add-product" onClick={() => {
                        setEditingProduct(null)
                        setFormData({ nome: '', descricao: '', preco: '', categoria_id: '', imagem_url: '', disponivel: true, item_upsell: false, quantidade_disponivel: 0, controlar_estoque: false, opcoes_personalizacao: [] })
                        setVariations([])
                        setDeletedVariationIds([])
                        setNewVarName('')
                        setNewVarPrice('')
                        setNewOptionText({})
                        setNewOptionPrice({})
                        setIsModalOpen(true)
                    }}>
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
                                {p.controlar_estoque && (
                                    <div className={`stock-badge ${p.quantidade_disponivel <= 5 ? 'low' : ''}`}>
                                        {p.quantidade_disponivel} em estoque
                                    </div>
                                )}
                                <span className="cat-label">{p.categorias?.nome}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Produto */}
            {isModalOpen && createPortal(
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

                                    <div className="input-group-premium">
                                        <label>Controle de Estoque</label>
                                        <div className="checkbox-wrapper">
                                            <input
                                                type="checkbox"
                                                id="controlar_estoque"
                                                checked={formData.controlar_estoque}
                                                onChange={e => setFormData(prev => ({ ...prev, controlar_estoque: e.target.checked }))}
                                            />
                                            <label htmlFor="controlar_estoque">Ativar controle de estoque</label>
                                        </div>
                                    </div>

                                    {formData.controlar_estoque && (
                                        <div className="input-group-premium animate-fade-in">
                                            <label>Quantidade Disponível</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.quantidade_disponivel}
                                                onChange={e => setFormData(prev => ({ ...prev, quantidade_disponivel: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) }))}
                                                placeholder="Ex: 50"
                                            />
                                        </div>
                                    )}
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

                                    {/* Variations Editor (Sabores/Tamanhos) */}
                                    <div className="input-group-premium">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <label style={{ margin: 0 }}>
                                                <Tag size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                                                Variações (Sabores / Tamanhos)
                                            </label>
                                        </div>

                                        {variations.length === 0 && (
                                            <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                                                Nenhuma variação. Adicione sabores (ex: Laranja, Acerola) ou tamanhos (ex: 300ml, 500ml).
                                            </p>
                                        )}

                                        <div className="variations-list">
                                            {variations.map((v, idx) => (
                                                <div key={v.id} className="variation-item">
                                                    <div className="variation-item__img-area">
                                                        {v.imagem_url ? (
                                                            <div className="variation-item__img-preview">
                                                                <img src={v.imagem_url} alt={v.nome} />
                                                                <button type="button" className="variation-item__img-remove" onClick={() => updateVariation(idx, 'imagem_url', '')}>
                                                                    <X size={10} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <label className="variation-item__img-upload">
                                                                <ImageIcon size={16} />
                                                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleVariationImageUpload(idx, e.target.files[0])} />
                                                            </label>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className="variation-item__name"
                                                        value={v.nome}
                                                        onChange={e => updateVariation(idx, 'nome', e.target.value)}
                                                        placeholder="Nome..."
                                                    />
                                                    <input
                                                        type="number"
                                                        className="variation-item__price"
                                                        value={v.preco}
                                                        onChange={e => updateVariation(idx, 'preco', e.target.value)}
                                                        placeholder="R$"
                                                        step="0.50"
                                                        min="0"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="variation-item__toggle"
                                                        onClick={() => updateVariation(idx, 'disponivel', !v.disponivel)}
                                                        title={v.disponivel !== false ? 'Disponível' : 'Esgotado'}
                                                    >
                                                        <div style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            backgroundColor: v.disponivel !== false ? '#10B981' : '#EF4444'
                                                        }} />
                                                    </button>
                                                    <button type="button" className="variation-item__remove" onClick={() => removeVariation(idx)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="custom-group-editor__add-row">
                                            <input
                                                type="text"
                                                placeholder="Nome da variação..."
                                                value={newVarName}
                                                onChange={e => setNewVarName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariation() } }}
                                                style={{ flex: 2 }}
                                            />
                                            <input
                                                type="number"
                                                placeholder="R$ Preço"
                                                value={newVarPrice}
                                                onChange={e => setNewVarPrice(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariation() } }}
                                                style={{ flex: 1, minWidth: 100 }}
                                                step="0.50"
                                                min="0"
                                            />
                                            <button type="button" onClick={addVariation}>
                                                <Plus size={14} />
                                            </button>
                                        </div>
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
                                                    {group.opcoes.map((opt, oIdx) => {
                                                        const name = typeof opt === 'string' ? opt : opt.nome
                                                        const price = typeof opt === 'string' ? 0 : Number(opt.preco) || 0
                                                        const img = typeof opt === 'string' ? null : opt.imagem_url
                                                        // Default to true if property doesn't exist (backward compatibility)
                                                        const isAvailable = typeof opt === 'string' ? true : (opt.disponivel !== false)

                                                        return (
                                                            <span key={oIdx} className={`custom-option-tag ${!isAvailable ? 'unavailable' : ''}`}>
                                                                {img && <img src={img} alt={name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />}
                                                                <span style={{ textDecoration: isAvailable ? 'none' : 'line-through', opacity: isAvailable ? 1 : 0.6 }}>
                                                                    {name}
                                                                </span>
                                                                {price > 0 && <span style={{ color: '#059669', fontSize: 11, fontWeight: 700 }}>+R$ {price.toFixed(2)}</span>}

                                                                {/* Availability Toggle */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const updatedGroup = { ...group }
                                                                        const updatedOptions = [...updatedGroup.opcoes]
                                                                        const currentOpt = updatedOptions[oIdx]

                                                                        // Ensure object structure
                                                                        const newOptObj = typeof currentOpt === 'string'
                                                                            ? { nome: currentOpt, preco: 0, disponivel: false }
                                                                            : { ...currentOpt, disponivel: !isAvailable }

                                                                        updatedOptions[oIdx] = newOptObj
                                                                        updatedGroup.opcoes = updatedOptions

                                                                        // Update state
                                                                        setFormData(prev => {
                                                                            const newPersonalization = [...prev.opcoes_personalizacao]
                                                                            newPersonalization[gIdx] = updatedGroup
                                                                            return { ...prev, opcoes_personalizacao: newPersonalization }
                                                                        })
                                                                    }}
                                                                    title={isAvailable ? "Marcar como esgotado" : "Marcar como disponível"}
                                                                    style={{
                                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                                        color: isAvailable ? '#10B981' : '#EF4444',
                                                                        display: 'flex', alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        width: 8, height: 8, borderRadius: '50%',
                                                                        backgroundColor: isAvailable ? '#10B981' : '#EF4444'
                                                                    }} />
                                                                </button>

                                                                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }} title="Adicionar imagem">
                                                                    <ImageIcon size={12} />
                                                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleOptionImageUpload(gIdx, oIdx, e.target.files[0])} />
                                                                </label>
                                                                <button type="button" onClick={() => removeOptionFromGroup(gIdx, oIdx)}>
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        )
                                                    })}
                                                </div>

                                                <div className="custom-group-editor__add-row">
                                                    <input
                                                        type="text"
                                                        placeholder="Nome..."
                                                        value={newOptionText[gIdx] || ''}
                                                        onChange={e => setNewOptionText(prev => ({ ...prev, [gIdx]: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOptionToGroup(gIdx) } }}
                                                        style={{ flex: 2 }}
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="R$ (0 = incluso)"
                                                        value={newOptionPrice[gIdx] || ''}
                                                        onChange={e => setNewOptionPrice(prev => ({ ...prev, [gIdx]: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOptionToGroup(gIdx) } }}
                                                        style={{ flex: 1, minWidth: 100 }}
                                                        step="0.50"
                                                        min="0"
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
                </div>,
                document.body
            )}

            {/* Quick Stats footer as in reference */}
            <div className="menu-pagination-bar">
                <p>Mostrando <strong>{filteredProducts.length}</strong> produtos</p>
                <div className="pagination-btns">
                    <button disabled>Anterior</button>
                    <button disabled>Próximo</button>
                </div>
            </div>

            {/* Modal de Confirmação de Exclusão */}
            {deleteConfirm.open && createPortal(
                <div className="admin-modal-overlay">
                    <div className="modal-confirm-delete animate-scale-in">
                        <div className="confirm-icon-box">
                            <Trash2 size={32} />
                        </div>
                        <h2>Excluir Produto?</h2>
                        <p>Esta ação não pode ser desfeita. O produto será removido permanentemente do cardápio.</p>

                        {deleteConfirm.error && (
                            <div className="error-message-box">
                                {deleteConfirm.error}
                            </div>
                        )}

                        <div className="confirm-actions">
                            <button
                                className="btn-confirm-cancel"
                                onClick={() => setDeleteConfirm({ open: false, id: null, loading: false, error: null })}
                                disabled={deleteConfirm.loading}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-confirm-delete"
                                onClick={confirmDelete}
                                disabled={deleteConfirm.loading}
                            >
                                {deleteConfirm.loading ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
