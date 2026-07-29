import { useState, useEffect, useMemo } from 'react'
import {
    Search, User, Phone, MapPin, Plus, Minus, X,
    ShoppingBag, ArrowRight, ArrowLeft, Bike, Store, Utensils,
    DollarSign, CreditCard, QrCode, AlertCircle, UserPlus
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProducts } from '../../hooks/useProducts'
import { useOrders } from '../../hooks/useOrders'
import n8nService from '../../services/n8nService'
import { formatCurrency } from '../../lib/utils'
import './CreateOrderModal.css'

export default function CreateOrderModal({ isOpen, onClose, onOrderCreated }) {
    const productsData = useProducts() || {}
    const products = productsData.products || []
    const categories = productsData.categories || []
    const loadingProducts = productsData.loading || false

    const { createOrder } = useOrders() || {}

    const [step, setStep] = useState(1) // 1: Cliente, 2: Itens, 3: Pagamento & Finalização

    // --- ESTADOS DO CLIENTE & ENDEREÇO ---
    const [searchTerm, setSearchTerm] = useState('')
    const [customerResults, setCustomerResults] = useState([])
    const [searchingCustomers, setSearchingCustomers] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [isNewCustomer, setIsNewCustomer] = useState(false)

    // Dados de contato e entrega
    const [clientName, setClientName] = useState('')
    const [clientPhone, setClientPhone] = useState('')
    const [address, setAddress] = useState({
        rua: '',
        numero: '',
        bairro: '',
        complemento: '',
        referencia: ''
    })
    const [saveAddressToProfile, setSaveAddressToProfile] = useState(true)

    // Bairros e Taxas de Entrega
    const [freightFees, setFreightFees] = useState([])
    const [taxaEntrega, setTaxaEntrega] = useState(0)

    // --- ESTADOS DO CARRINHO & CARDÁPIO ---
    const [cartItems, setCartItems] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('todos')
    const [productSearch, setProductSearch] = useState('')
    const [customizingProduct, setCustomizingProduct] = useState(null)
    const [selectedVariation, setSelectedVariation] = useState(null)
    const [itemNotes, setItemNotes] = useState('')

    // --- ESTADOS DE CHECKOUT ---
    const [tipoPedido, setTipoPedido] = useState('entrega') // entrega, retirada, mesa
    const [formaPagamento, setFormaPagamento] = useState('pix') // pix, cartao_credito, cartao_debito, dinheiro
    const [trocoPara, setTrocoPara] = useState('')
    const [precisaTroco, setPrecisaTroco] = useState(false)
    const [observacoes, setObservacoes] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    // Carregar taxas de entrega
    useEffect(() => {
        if (!isOpen) return
        async function fetchFreight() {
            try {
                const { data } = await supabase
                    .from('taxas_entrega')
                    .select('*')
                    .order('local')
                setFreightFees(data || [])
            } catch (err) {
                console.error('Erro ao buscar taxas de entrega:', err)
            }
        }
        fetchFreight()
    }, [isOpen])

    // Busca de clientes com Debounce
    useEffect(() => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setCustomerResults([])
            return
        }

        const timer = setTimeout(async () => {
            setSearchingCustomers(true)
            try {
                const term = searchTerm.trim()
                const { data } = await supabase
                    .from('clientes')
                    .select('id, codigo, nome, telefone, dados')
                    .or(`nome.ilike.%${term}%,telefone.ilike.%${term}%`)
                    .limit(10)

                setCustomerResults(data || [])
            } catch (err) {
                console.error('Erro ao buscar clientes:', err)
            } finally {
                setSearchingCustomers(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchTerm])

    // Atualizar taxa de entrega quando o bairro muda
    useEffect(() => {
        if (tipoPedido !== 'entrega') {
            setTaxaEntrega(0)
            return
        }
        if (address?.bairro) {
            const bairroTarget = String(address.bairro).toLowerCase().trim()
            const found = (freightFees || []).find(f => f?.local && String(f.local).toLowerCase().trim() === bairroTarget)
            if (found) {
                setTaxaEntrega(Number(found.valor_frete) || 0)
            }
        }
    }, [address?.bairro, tipoPedido, freightFees])

    if (!isOpen) return null

    // Handlers do Cliente
    function handleSelectCustomer(c) {
        if (!c) return
        setSelectedCustomer(c)
        setIsNewCustomer(false)
        setClientName(c.nome || '')
        setClientPhone(c.telefone || c.dados?.whatsapp || '')
        const addr = c.dados?.endereco || c.dados || {}
        setAddress({
            rua: addr.rua || addr.street || '',
            numero: addr.numero || addr.number || '',
            bairro: addr.bairro || addr.neighborhood || '',
            complemento: addr.complemento || '',
            referencia: addr.referencia || addr.reference || ''
        })
        setCustomerResults([])
        setSearchTerm('')
    }

    function handleStartNewCustomer() {
        setSelectedCustomer(null)
        setIsNewCustomer(true)
        setClientName(searchTerm)
        setClientPhone('')
        setAddress({ rua: '', numero: '', bairro: '', complemento: '', referencia: '' })
        setCustomerResults([])
    }

    // Adicionar produto ao carrinho
    function handleAddProduct(product) {
        if (!product) return
        if (Array.isArray(product.variacoes_produto) && product.variacoes_produto.length > 0) {
            setCustomizingProduct(product)
            setSelectedVariation(product.variacoes_produto[0])
            setItemNotes('')
            return
        }

        addItemToCart({
            produto_id: product.id,
            nome: product.nome || 'Produto',
            preco: Number(product.preco) || 0,
            preco_unitario: Number(product.preco) || 0,
            quantidade: 1,
            personalizacao: null,
            imagem_url: product.imagem_url
        })
    }

    function handleConfirmCustomization() {
        if (!customizingProduct) return

        const price = selectedVariation ? Number(selectedVariation.preco) : Number(customizingProduct.preco)
        const name = selectedVariation
            ? `${customizingProduct.nome} (${selectedVariation.nome})`
            : customizingProduct.nome

        addItemToCart({
            produto_id: customizingProduct.id,
            variacao_id: selectedVariation?.id || null,
            nome: name || 'Produto Customizado',
            preco: price,
            preco_unitario: price,
            quantidade: 1,
            personalizacao: itemNotes ? { observacao: itemNotes } : null,
            imagem_url: customizingProduct.imagem_url
        })

        setCustomizingProduct(null)
        setSelectedVariation(null)
        setItemNotes('')
    }

    function addItemToCart(newItem) {
        setCartItems(prev => {
            const existingIndex = prev.findIndex(item =>
                item.produto_id === newItem.produto_id &&
                item.variacao_id === newItem.variacao_id &&
                JSON.stringify(item.personalizacao) === JSON.stringify(newItem.personalizacao)
            )

            if (existingIndex > -1) {
                const updated = [...prev]
                updated[existingIndex].quantidade += 1
                return updated
            }
            return [...prev, newItem]
        })
    }

    function handleUpdateQuantity(index, delta) {
        setCartItems(prev => {
            const updated = [...prev]
            if (!updated[index]) return prev
            const newQty = updated[index].quantidade + delta
            if (newQty <= 0) {
                return updated.filter((_, i) => i !== index)
            }
            updated[index].quantidade = newQty
            return updated
        })
    }

    // Totais
    const subtotal = useMemo(() => {
        return (cartItems || []).reduce((acc, item) => acc + ((item.preco_unitario || 0) * (item.quantidade || 1)), 0)
    }, [cartItems])

    const totalOrder = useMemo(() => {
        return subtotal + (tipoPedido === 'entrega' ? taxaEntrega : 0)
    }, [subtotal, tipoPedido, taxaEntrega])

    // Produtos filtrados
    const filteredProducts = useMemo(() => {
        if (!Array.isArray(products)) return []
        const searchLower = (productSearch || '').toLowerCase().trim()
        return products.filter(p => {
            if (!p || !p.nome) return false
            const matchCategory = selectedCategory === 'todos' || p.categoria_id === selectedCategory
            const matchSearch = !searchLower || p.nome.toLowerCase().includes(searchLower)
            return matchCategory && matchSearch && p.disponivel !== false
        })
    }, [products, selectedCategory, productSearch])

    // Finalizar Pedido
    async function handleSubmitOrder() {
        setErrorMessage('')
        if (!clientName || !clientName.trim()) {
            setErrorMessage('Por favor, informe o nome do cliente.')
            setStep(1)
            return
        }
        if (!cartItems || cartItems.length === 0) {
            setErrorMessage('Selecione ao menos 1 item para o pedido.')
            setStep(2)
            return
        }
        if (tipoPedido === 'entrega' && (!address.rua || !address.rua.trim())) {
            setErrorMessage('Por favor, preencha o endereço (rua e número) para entrega.')
            setStep(1)
            return
        }

        setIsSubmitting(true)
        try {
            let targetClientId = selectedCustomer?.id

            if (targetClientId && saveAddressToProfile) {
                const baseDados = selectedCustomer.dados || {}
                await supabase
                    .from('clientes')
                    .update({
                        dados: {
                            ...baseDados,
                            nome: clientName,
                            whatsapp: clientPhone,
                            endereco: address
                        }
                    })
                    .eq('id', targetClientId)
            }

            const addressData = tipoPedido === 'entrega' ? {
                nome_recebedor: clientName,
                telefone_recebedor: clientPhone,
                rua: address.rua,
                numero: address.numero,
                bairro: address.bairro,
                complemento: address.complemento,
                referencia: address.referencia
            } : null

            const orderPayload = {
                nome_cliente: clientName,
                telefone_cliente: (clientPhone || '').replace(/\D/g, ''),
                tipo_pedido: tipoPedido,
                subtotal,
                taxa_entrega: tipoPedido === 'entrega' ? taxaEntrega : 0,
                valor_total: totalOrder,
                forma_pagamento: formaPagamento,
                metodo_pagamento: formaPagamento,
                troco_para: precisaTroco && trocoPara ? parseFloat(trocoPara) : null,
                endereco: addressData,
                observacoes: observacoes ? observacoes.trim() : null,
                itens: cartItems,
                cliente_id: targetClientId || null,
                codigo_cliente: selectedCustomer?.codigo || null,
                pago: false
            }

            let pedido = null
            if (typeof createOrder === 'function') {
                pedido = await createOrder(orderPayload)
            }

            try {
                const webhookBody = {
                    ...orderPayload,
                    ...(pedido || {}),
                    cliente_original: selectedCustomer
                }
                if (n8nService && typeof n8nService.sendNovoPedido === 'function') {
                    await n8nService.sendNovoPedido(webhookBody)
                }

                if (tipoPedido === 'entrega' && pedido) {
                    supabase.functions.invoke('notify-driver', {
                        body: {
                            numero_pedido: pedido.numero_pedido || pedido.id,
                            nome_cliente: clientName,
                            endereco_bairro: address.bairro,
                            valor_total: totalOrder,
                            tipo_notificacao: 'novo_pedido'
                        }
                    })
                }
            } catch (wErr) {
                console.warn('[CreateOrderModal] Webhook error:', wErr)
            }

            onOrderCreated?.(pedido)
            onClose()
        } catch (err) {
            console.error('[CreateOrderModal] Erro ao criar pedido:', err)
            setErrorMessage('Erro ao salvar pedido: ' + err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="create-order-overlay">
            <div className="create-order-modal animate-scale-in">
                {/* Cabeçalho */}
                <div className="create-order-header">
                    <div>
                        <h2>⚡ Novo Pedido Manual</h2>
                        <p>Atendimento por Telefone, WhatsApp ou Balcão</p>
                    </div>
                    <button className="btn-close-modal" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper Navigator */}
                <div className="create-order-stepper">
                    <button
                        className={`step-tab ${step === 1 ? 'active' : ''} ${selectedCustomer || clientName ? 'completed' : ''}`}
                        onClick={() => setStep(1)}
                    >
                        <span className="step-num">1</span>
                        <span className="step-text">Cliente & Endereço</span>
                    </button>
                    <button
                        className={`step-tab ${step === 2 ? 'active' : ''} ${cartItems.length > 0 ? 'completed' : ''}`}
                        onClick={() => setStep(2)}
                    >
                        <span className="step-num">2</span>
                        <span className="step-text">Itens ({cartItems.length})</span>
                    </button>
                    <button
                        className={`step-tab ${step === 3 ? 'active' : ''}`}
                        onClick={() => setStep(3)}
                    >
                        <span className="step-num">3</span>
                        <span className="step-text">Pagamento ({formatCurrency(totalOrder)})</span>
                    </button>
                </div>

                {errorMessage && (
                    <div className="create-order-error">
                        <AlertCircle size={18} />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Conteúdo do Passo */}
                <div className="create-order-body">
                    {/* PASSO 1: CLIENTE E ENDEREÇO */}
                    {step === 1 && (
                        <div className="step-content animate-fade-in">
                            <div className="section-box">
                                <h3><User size={18} /> Seleção do Cliente</h3>

                                {!selectedCustomer && !isNewCustomer ? (
                                    <div className="customer-search-box">
                                        <div className="search-input-wrapper">
                                            <Search size={18} className="search-icon" />
                                            <input
                                                type="text"
                                                placeholder="Digite o Nome ou WhatsApp do cliente..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                autoFocus
                                            />
                                        </div>

                                        {searchingCustomers && <div className="searching-spinner">Buscando clientes...</div>}

                                        {(customerResults || []).length > 0 && (
                                            <div className="customer-results-list">
                                                {customerResults.map(c => (
                                                    <div
                                                        key={c.id}
                                                        className="customer-result-item"
                                                        onClick={() => handleSelectCustomer(c)}
                                                    >
                                                        <div className="cust-info">
                                                            <strong>{c.nome}</strong>
                                                            <span><Phone size={12} /> {c.telefone || c.dados?.whatsapp || 'Sem telefone'}</span>
                                                        </div>
                                                        <button className="btn-select-cust">Selecionar</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {searchTerm.length >= 2 && (customerResults || []).length === 0 && !searchingCustomers && (
                                            <div className="no-customer-found">
                                                <span>Nenhum cliente encontrado com "{searchTerm}".</span>
                                                <button className="btn-new-cust-action" onClick={handleStartNewCustomer}>
                                                    <UserPlus size={16} /> Cadastrar "{searchTerm}"
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="selected-customer-card">
                                        <div className="card-top">
                                            <div>
                                                <span className="badge-cust">{selectedCustomer ? 'Cliente Cadastrado' : 'Novo Cliente'}</span>
                                                <h4>{clientName}</h4>
                                            </div>
                                            <button className="btn-change-cust" onClick={() => { setSelectedCustomer(null); setIsNewCustomer(false); }}>
                                                Trocar Cliente
                                            </button>
                                        </div>

                                        <div className="input-row" style={{ marginTop: '12px' }}>
                                            <div className="input-group">
                                                <label>Nome Completo</label>
                                                <input
                                                    type="text"
                                                    value={clientName}
                                                    onChange={e => setClientName(e.target.value)}
                                                    placeholder="Nome do cliente"
                                                />
                                            </div>
                                            <div className="input-group">
                                                <label>WhatsApp / Telefone</label>
                                                <input
                                                    type="text"
                                                    value={clientPhone}
                                                    onChange={e => setClientPhone(e.target.value)}
                                                    placeholder="(99) 99999-9999"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Endereço de Entrega */}
                            <div className="section-box" style={{ marginTop: '16px' }}>
                                <h3><MapPin size={18} /> Endereço de Entrega</h3>

                                <div className="input-grid">
                                    <div className="input-group span-2">
                                        <label>Rua / Logradouro</label>
                                        <input
                                            type="text"
                                            value={address.rua}
                                            onChange={e => setAddress({ ...address, rua: e.target.value })}
                                            placeholder="Ex: Av. Beira Mar"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Número</label>
                                        <input
                                            type="text"
                                            value={address.numero}
                                            onChange={e => setAddress({ ...address, numero: e.target.value })}
                                            placeholder="123"
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>Bairro</label>
                                        <select
                                            value={address.bairro}
                                            onChange={e => setAddress({ ...address, bairro: e.target.value })}
                                        >
                                            <option value="">Selecione o Bairro...</option>
                                            {(freightFees || []).map(f => (
                                                <option key={f.id} value={f.local}>
                                                    {f.local} ({formatCurrency(f.valor_frete)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="input-group">
                                        <label>Complemento</label>
                                        <input
                                            type="text"
                                            value={address.complemento}
                                            onChange={e => setAddress({ ...address, complemento: e.target.value })}
                                            placeholder="Apt 101, Bloco B"
                                        />
                                    </div>

                                    <div className="input-group span-2">
                                        <label>Ponto de Referência</label>
                                        <input
                                            type="text"
                                            value={address.referencia}
                                            onChange={e => setAddress({ ...address, referencia: e.target.value })}
                                            placeholder="Próximo à farmácia..."
                                        />
                                    </div>
                                </div>

                                {selectedCustomer && (
                                    <label className="checkbox-save-address">
                                        <input
                                            type="checkbox"
                                            checked={saveAddressToProfile}
                                            onChange={e => setSaveAddressToProfile(e.target.checked)}
                                        />
                                        <span>Salvar/Atualizar este endereço no perfil do cliente</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PASSO 2: CARDÁPIO & ITENS */}
                    {step === 2 && (
                        <div className="step-content animate-fade-in step-menu-split">
                            {/* Esquerda: Lista de Produtos */}
                            <div className="menu-products-side">
                                <div className="menu-filters">
                                    <div className="search-input-wrapper">
                                        <Search size={16} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Buscar espetinho, bebida..."
                                            value={productSearch}
                                            onChange={e => setProductSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="categories-pills">
                                        <button
                                            className={`cat-pill ${selectedCategory === 'todos' ? 'active' : ''}`}
                                            onClick={() => setSelectedCategory('todos')}
                                        >
                                            Todos
                                        </button>
                                        {(categories || []).map(c => (
                                            <button
                                                key={c.id}
                                                className={`cat-pill ${selectedCategory === c.id ? 'active' : ''}`}
                                                onClick={() => setSelectedCategory(c.id)}
                                            >
                                                {c.nome}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="products-grid-scroll">
                                    {loadingProducts ? (
                                        <div className="loading-products">Carregando cardápio...</div>
                                    ) : (
                                        (filteredProducts || []).map(p => (
                                            <div key={p.id} className="product-quick-card" onClick={() => handleAddProduct(p)}>
                                                {p.imagem_url && <img src={p.imagem_url} alt={p.nome} className="prod-img" />}
                                                <div className="prod-info">
                                                    <strong>{p.nome}</strong>
                                                    <span className="prod-price">{formatCurrency(p.preco)}</span>
                                                </div>
                                                <button className="btn-add-quick"><Plus size={16} /></button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Direita: Resumo do Carrinho */}
                            <div className="cart-summary-side">
                                <h3><ShoppingBag size={18} /> Itens do Pedido ({cartItems.length})</h3>

                                <div className="cart-items-list">
                                    {cartItems.length === 0 ? (
                                        <div className="empty-cart-msg">
                                            <span>Nenhum item adicionado ainda.</span>
                                            <p>Clique nos produtos à esquerda para adicionar.</p>
                                        </div>
                                    ) : (
                                        cartItems.map((item, idx) => (
                                            <div key={idx} className="cart-item-row">
                                                <div className="item-details">
                                                    <strong>{item.nome}</strong>
                                                    {item.personalizacao?.observacao && (
                                                        <span className="item-obs">Obs: {item.personalizacao.observacao}</span>
                                                    )}
                                                    <span className="item-price">{formatCurrency(item.preco_unitario * item.quantidade)}</span>
                                                </div>
                                                <div className="qty-controls">
                                                    <button onClick={() => handleUpdateQuantity(idx, -1)}><Minus size={14} /></button>
                                                    <span>{item.quantidade}</span>
                                                    <button onClick={() => handleUpdateQuantity(idx, 1)}><Plus size={14} /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="cart-totals">
                                    <div className="total-row">
                                        <span>Subtotal</span>
                                        <strong>{formatCurrency(subtotal)}</strong>
                                    </div>
                                    {tipoPedido === 'entrega' && (
                                        <div className="total-row">
                                            <span>Taxa de Entrega</span>
                                            <strong>{formatCurrency(taxaEntrega)}</strong>
                                        </div>
                                    )}
                                    <div className="total-row main-total">
                                        <span>Total</span>
                                        <strong>{formatCurrency(totalOrder)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASSO 3: CHECKOUT & PAGAMENTO */}
                    {step === 3 && (
                        <div className="step-content animate-fade-in">
                            {/* Tipo de Pedido */}
                            <div className="section-box">
                                <h3>Tipo de Pedido</h3>
                                <div className="order-types-grid">
                                    <button
                                        className={`type-btn ${tipoPedido === 'entrega' ? 'active' : ''}`}
                                        onClick={() => setTipoPedido('entrega')}
                                    >
                                        <Bike size={22} />
                                        <span>Entrega (Delivery)</span>
                                    </button>
                                    <button
                                        className={`type-btn ${tipoPedido === 'retirada' ? 'active' : ''}`}
                                        onClick={() => setTipoPedido('retirada')}
                                    >
                                        <Store size={22} />
                                        <span>Retirada Balcão</span>
                                    </button>
                                    <button
                                        className={`type-btn ${tipoPedido === 'mesa' ? 'active' : ''}`}
                                        onClick={() => setTipoPedido('mesa')}
                                    >
                                        <Utensils size={22} />
                                        <span>Mesa / Consumo Local</span>
                                    </button>
                                </div>
                            </div>

                            {/* Forma de Pagamento */}
                            <div className="section-box" style={{ marginTop: '16px' }}>
                                <h3>Forma de Pagamento</h3>
                                <div className="payments-grid">
                                    <button
                                        className={`pay-btn ${formaPagamento === 'pix' ? 'active' : ''}`}
                                        onClick={() => setFormaPagamento('pix')}
                                    >
                                        <QrCode size={20} />
                                        <span>Pix</span>
                                    </button>
                                    <button
                                        className={`pay-btn ${formaPagamento === 'cartao_credito' ? 'active' : ''}`}
                                        onClick={() => setFormaPagamento('cartao_credito')}
                                    >
                                        <CreditCard size={20} />
                                        <span>Cartão Crédito</span>
                                    </button>
                                    <button
                                        className={`pay-btn ${formaPagamento === 'cartao_debito' ? 'active' : ''}`}
                                        onClick={() => setFormaPagamento('cartao_debito')}
                                    >
                                        <CreditCard size={20} />
                                        <span>Cartão Débito</span>
                                    </button>
                                    <button
                                        className={`pay-btn ${formaPagamento === 'dinheiro' ? 'active' : ''}`}
                                        onClick={() => setFormaPagamento('dinheiro')}
                                    >
                                        <DollarSign size={20} />
                                        <span>Dinheiro</span>
                                    </button>
                                </div>

                                {formaPagamento === 'dinheiro' && (
                                    <div className="troco-box" style={{ marginTop: '12px' }}>
                                        <label className="checkbox-save-address">
                                            <input
                                                type="checkbox"
                                                checked={precisaTroco}
                                                onChange={e => setPrecisaTroco(e.target.checked)}
                                            />
                                            <span>Precisa de Troco?</span>
                                        </label>
                                        {precisaTroco && (
                                            <div className="input-group" style={{ marginTop: '8px', maxWidth: '200px' }}>
                                                <label>Troco para quanto?</label>
                                                <input
                                                    type="number"
                                                    placeholder="Ex: 50.00"
                                                    value={trocoPara}
                                                    onChange={e => setTrocoPara(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Observações */}
                            <div className="section-box" style={{ marginTop: '16px' }}>
                                <h3>Observações do Pedido</h3>
                                <textarea
                                    className="order-notes-textarea"
                                    rows="2"
                                    placeholder="Ex: Ponto da carne bem passado, entregar na recepção..."
                                    value={observacoes}
                                    onChange={e => setObservacoes(e.target.value)}
                                />
                            </div>

                            {/* Resumo Final */}
                            <div className="final-checkout-summary">
                                <div className="summary-col">
                                    <span>Cliente: <strong>{clientName || 'Não informado'}</strong> ({clientPhone})</span>
                                    {tipoPedido === 'entrega' && <span>Entrega: {address.rua}, {address.numero} - {address.bairro}</span>}
                                </div>
                                <div className="summary-total-col">
                                    <span>Total a Pagar</span>
                                    <h2>{formatCurrency(totalOrder)}</h2>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rodapé / Ações */}
                <div className="create-order-footer">
                    {step > 1 ? (
                        <button className="btn-stepper-nav secondary" onClick={() => setStep(step - 1)}>
                            <ArrowLeft size={16} /> Voltar
                        </button>
                    ) : <div />}

                    {step < 3 ? (
                        <button className="btn-stepper-nav primary" onClick={() => setStep(step + 1)}>
                            Avançar <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button
                            className="btn-confirm-order"
                            onClick={handleSubmitOrder}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Finalizando...' : '⚡ Confirmar e Criar Pedido'}
                        </button>
                    )}
                </div>
            </div>

            {/* Modal de Customização de Produto (Variações/Pontos da carne) */}
            {customizingProduct && (
                <div className="customizing-overlay animate-fade-in">
                    <div className="customizing-modal animate-scale-in">
                        <div className="custom-header">
                            <h3>{customizingProduct.nome}</h3>
                            <button onClick={() => setCustomizingProduct(null)}><X size={18} /></button>
                        </div>
                        <div className="custom-body">
                            {Array.isArray(customizingProduct.variacoes_produto) && customizingProduct.variacoes_produto.length > 0 && (
                                <div className="variations-section">
                                    <label>Escolha a Variação / Opção:</label>
                                    <div className="variations-list">
                                        {customizingProduct.variacoes_produto.map(v => (
                                            <button
                                                key={v.id}
                                                className={`var-btn ${selectedVariation?.id === v.id ? 'active' : ''}`}
                                                onClick={() => setSelectedVariation(v)}
                                            >
                                                <span>{v.nome}</span>
                                                <strong>{formatCurrency(v.preco)}</strong>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="input-group" style={{ marginTop: '12px' }}>
                                <label>Observações para este item (opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Sem salada, molho à parte"
                                    value={itemNotes}
                                    onChange={e => setItemNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="custom-footer">
                            <button className="btn-add-custom" onClick={handleConfirmCustomization}>
                                Adicionar ao Pedido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
