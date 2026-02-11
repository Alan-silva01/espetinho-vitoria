import { useState, useEffect, useRef } from 'react'
import {
    Plus, Search, Edit3, Trash2, Image as ImageIcon,
    X, Save, Upload, ChevronDown, AlertCircle, Check
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadImage, isCloudinaryConfigured } from '../../lib/cloudinary'
import { formatCurrency } from '../../lib/utils'
import './MenuPage.css'

export default function MenuPage() {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterCat, setFilterCat] = useState('')
    const [modal, setModal] = useState(null) // null | { type: 'add'|'edit', product?: obj }
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [toast, setToast] = useState(null)

    // Fetch data
    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const [{ data: prods }, { data: cats }] = await Promise.all([
            supabase.from('produtos').select('*, categorias(nome)').order('ordem_exibicao'),
            supabase.from('categorias').select('*').order('ordem_exibicao'),
        ])
        setProducts(prods || [])
        setCategories(cats || [])
        setLoading(false)
    }

    function showToast(message, type = 'success') {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Filter products
    const filtered = products.filter(p => {
        const matchSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase())
        const matchCat = !filterCat || p.categoria_id === filterCat
        return matchSearch && matchCat
    })

    // Delete product
    async function handleDelete(id) {
        const { error } = await supabase.from('produtos').delete().eq('id', id)
        if (error) {
            showToast('Erro ao excluir produto', 'error')
        } else {
            setProducts(prev => prev.filter(p => p.id !== id))
            showToast('Produto excluído com sucesso')
        }
        setDeleteConfirm(null)
    }

    // Toggle availability
    async function toggleDisponivel(id, current) {
        const { error } = await supabase.from('produtos').update({ disponivel: !current }).eq('id', id)
        if (!error) {
            setProducts(prev => prev.map(p => p.id === id ? { ...p, disponivel: !current } : p))
        }
    }

    return (
        <div className="admin-menu">
            {/* Header */}
            <div className="admin-menu__header">
                <div>
                    <h1>Gestão de Cardápio</h1>
                    <p>{products.length} produtos cadastrados</p>
                </div>
                <button className="admin-btn admin-btn--primary" onClick={() => setModal({ type: 'add' })}>
                    <Plus size={18} />
                    Novo Produto
                </button>
            </div>

            {/* Filters */}
            <div className="admin-menu__filters">
                <div className="admin-search">
                    <Search size={18} />
                    <input
                        placeholder="Buscar produto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="admin-select"
                    value={filterCat}
                    onChange={e => setFilterCat(e.target.value)}
                >
                    <option value="">Todas categorias</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                </select>
            </div>

            {/* Products Table */}
            {loading ? (
                <div className="admin-loading">Carregando...</div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Categoria</th>
                                <th>Preço</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(product => (
                                <tr key={product.id}>
                                    <td>
                                        <div className="admin-product-cell">
                                            <div className="admin-product-img">
                                                {product.imagem_url ? (
                                                    <img src={product.imagem_url} alt={product.nome} />
                                                ) : (
                                                    <ImageIcon size={20} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="admin-product-name">{product.nome}</p>
                                                <p className="admin-product-desc">{product.descricao?.slice(0, 50)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="admin-badge">{product.categorias?.nome || '—'}</span>
                                    </td>
                                    <td className="admin-price">{formatCurrency(product.preco)}</td>
                                    <td>
                                        <button
                                            className={`admin-toggle ${product.disponivel ? 'admin-toggle--on' : ''}`}
                                            onClick={() => toggleDisponivel(product.id, product.disponivel)}
                                        >
                                            <span className="admin-toggle__dot" />
                                            <span>{product.disponivel ? 'Ativo' : 'Inativo'}</span>
                                        </button>
                                    </td>
                                    <td>
                                        <div className="admin-actions">
                                            <button
                                                className="admin-action-btn"
                                                title="Editar"
                                                onClick={() => setModal({ type: 'edit', product })}
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                className="admin-action-btn admin-action-btn--danger"
                                                title="Excluir"
                                                onClick={() => setDeleteConfirm(product)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="admin-empty">Nenhum produto encontrado</div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {modal && (
                <ProductModal
                    type={modal.type}
                    product={modal.product}
                    categories={categories}
                    onClose={() => setModal(null)}
                    onSave={() => {
                        setModal(null)
                        fetchData()
                        showToast(modal.type === 'add' ? 'Produto criado!' : 'Produto atualizado!')
                    }}
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="admin-modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="admin-confirm" onClick={e => e.stopPropagation()}>
                        <AlertCircle size={40} color="#EF4444" />
                        <h3>Excluir Produto?</h3>
                        <p>Tem certeza que deseja excluir <strong>{deleteConfirm.nome}</strong>? Esta ação não pode ser desfeita.</p>
                        <div className="admin-confirm__actions">
                            <button className="admin-btn admin-btn--ghost" onClick={() => setDeleteConfirm(null)}>
                                Cancelar
                            </button>
                            <button className="admin-btn admin-btn--danger" onClick={() => handleDelete(deleteConfirm.id)}>
                                <Trash2 size={16} /> Excluir
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

/* ===== Product Modal (Add / Edit) ===== */
function ProductModal({ type, product, categories, onClose, onSave }) {
    const [form, setForm] = useState({
        nome: product?.nome || '',
        descricao: product?.descricao || '',
        preco: product?.preco?.toString() || '',
        categoria_id: product?.categoria_id || '',
        imagem_url: product?.imagem_url || '',
        disponivel: product?.disponivel ?? true,
        item_upsell: product?.item_upsell ?? false,
    })
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [saving, setSaving] = useState(false)
    const [imagePreview, setImagePreview] = useState(product?.imagem_url || '')
    const fileRef = useRef(null)

    function handleChange(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleImageUpload(e) {
        const file = e.target.files?.[0]
        if (!file) return

        // Preview local
        const reader = new FileReader()
        reader.onload = () => setImagePreview(reader.result)
        reader.readAsDataURL(file)

        if (isCloudinaryConfigured) {
            try {
                setUploading(true)
                setUploadProgress(0)
                const result = await uploadImage(file, {
                    folder: 'espetinho-vitoria/produtos',
                    onProgress: setUploadProgress,
                })
                handleChange('imagem_url', result.url)
                setUploading(false)
            } catch (err) {
                alert('Erro no upload: ' + err.message)
                setUploading(false)
            }
        } else {
            // Without Cloudinary: use direct URL input
            alert('Cloudinary não configurado. Use a URL direta da imagem.')
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.nome || !form.preco || !form.categoria_id) {
            alert('Preencha nome, preço e categoria')
            return
        }

        setSaving(true)
        const payload = {
            nome: form.nome,
            descricao: form.descricao,
            preco: parseFloat(form.preco),
            categoria_id: form.categoria_id,
            imagem_url: form.imagem_url,
            disponivel: form.disponivel,
            item_upsell: form.item_upsell,
        }

        let error
        if (type === 'add') {
            ; ({ error } = await supabase.from('produtos').insert(payload))
        } else {
            ; ({ error } = await supabase.from('produtos').update(payload).eq('id', product.id))
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
                    <h2>{type === 'add' ? 'Novo Produto' : 'Editar Produto'}</h2>
                    <button className="admin-modal__close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form className="admin-modal__form" onSubmit={handleSubmit}>
                    {/* Image Upload */}
                    <div className="admin-form-group">
                        <label>Imagem do Produto</label>
                        <div
                            className="admin-image-upload"
                            onClick={() => fileRef.current?.click()}
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="admin-image-preview" />
                            ) : (
                                <div className="admin-image-placeholder">
                                    <Upload size={32} />
                                    <span>Clique para enviar imagem</span>
                                </div>
                            )}
                            {uploading && (
                                <div className="admin-upload-overlay">
                                    <div className="admin-upload-bar">
                                        <div className="admin-upload-fill" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                    <span>{uploadProgress}%</span>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileRef}
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                        />
                        {/* Direct URL input fallback */}
                        <input
                            type="url"
                            className="admin-input admin-input--small"
                            placeholder="Ou cole a URL da imagem..."
                            value={form.imagem_url}
                            onChange={e => {
                                handleChange('imagem_url', e.target.value)
                                setImagePreview(e.target.value)
                            }}
                        />
                    </div>

                    {/* Name */}
                    <div className="admin-form-group">
                        <label>Nome do Produto *</label>
                        <input
                            type="text"
                            className="admin-input"
                            placeholder="Ex: Espetinho de Picanha"
                            value={form.nome}
                            onChange={e => handleChange('nome', e.target.value)}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="admin-form-group">
                        <label>Descrição</label>
                        <textarea
                            className="admin-input admin-textarea"
                            placeholder="Descreva o produto..."
                            value={form.descricao}
                            onChange={e => handleChange('descricao', e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Price + Category row */}
                    <div className="admin-form-row">
                        <div className="admin-form-group">
                            <label>Preço (R$) *</label>
                            <input
                                type="number"
                                className="admin-input"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                value={form.preco}
                                onChange={e => handleChange('preco', e.target.value)}
                                required
                            />
                        </div>
                        <div className="admin-form-group">
                            <label>Categoria *</label>
                            <select
                                className="admin-input"
                                value={form.categoria_id}
                                onChange={e => handleChange('categoria_id', e.target.value)}
                                required
                            >
                                <option value="">Selecione...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="admin-form-row">
                        <label className="admin-checkbox">
                            <input
                                type="checkbox"
                                checked={form.disponivel}
                                onChange={e => handleChange('disponivel', e.target.checked)}
                            />
                            <span>Disponível</span>
                        </label>
                        <label className="admin-checkbox">
                            <input
                                type="checkbox"
                                checked={form.item_upsell}
                                onChange={e => handleChange('item_upsell', e.target.checked)}
                            />
                            <span>Item de Upsell</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="admin-modal__actions">
                        <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                            <Save size={16} />
                            {saving ? 'Salvando...' : (type === 'add' ? 'Criar Produto' : 'Salvar Alterações')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
