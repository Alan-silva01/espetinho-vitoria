import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard, Receipt, Edit3, CheckCircle, User, X, AlertTriangle } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useOrders } from '../../hooks/useOrders'
import { useCustomer } from '../../context/CustomerContext'
import { formatCurrency, getImageUrl, filterPersonalizacao } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import OutOfStockModal from '../../components/customer/OutOfStockModal'
import './CheckoutPage.css'

export default function CheckoutPage() {
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { items, subtotal, clearCart, removeItem } = useCart()
    const { createOrder, loading } = useOrders()
    const { customer, updateLastOrder } = useCustomer()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const submitLockRef = useRef(false)
    const [validationError, setValidationError] = useState({ open: false, message: '' })
    const nomeInputRef = useRef(null)
    const [outOfStockItems, setOutOfStockItems] = useState([])
    const [showOutOfStockModal, setShowOutOfStockModal] = useState(false)

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    // Order type
    const [tipoPedido, setTipoPedido] = useState(() => {
        return localStorage.getItem('espetinho_tipo_pedido') || 'entrega'
    })

    useEffect(() => {
        localStorage.setItem('espetinho_tipo_pedido', tipoPedido)
    }, [tipoPedido])

    // Mesa data (from QR code scan)
    const mesaId = tipoPedido === 'mesa' ? localStorage.getItem('espetinho_mesa_id') : null
    const mesaNumero = tipoPedido === 'mesa' ? localStorage.getItem('espetinho_mesa_numero') : null

    // Address Data
    const [addressData, setAddressData] = useState(() => {
        const saved = localStorage.getItem('espetinho_delivery_data')
        if (saved) {
            try {
                const data = JSON.parse(saved)
                return {
                    rua: data.rua || data.street || '',
                    numero: data.numero || data.number || '',
                    bairro: data.bairro || data.neighborhood || '',
                    referencia: data.referencia || data.reference || '',
                    nome_recebedor: data.nome_recebedor || data.receiverName || '',
                    telefone_recebedor: data.telefone_recebedor || data.receiverPhone || '',
                    google_maps_link: data.google_maps_link || ''
                }
            } catch {
                // Ignore parsing errors
            }
        }
        return {
            rua: '',
            numero: '',
            bairro: '',
            referencia: '',
            nome_recebedor: '',
            telefone_recebedor: '',
            google_maps_link: ''
        }
    })

    // Fetch Neighborhood Fee
    const [taxaEntrega, setTaxaEntrega] = useState(0)

    useEffect(() => {
        async function fetchFee() {
            if (tipoPedido === 'retirada' || tipoPedido === 'mesa' || !addressData.bairro) {
                setTaxaEntrega(0)
                return
            }

            const { data } = await supabase
                .from('taxas_entrega')
                .select('valor_frete')
                .eq('local', addressData.bairro)
                .single()

            if (data) {
                setTaxaEntrega(Number(data.valor_frete))
            } else {
                setTaxaEntrega(5.0) // Fallback
            }
        }
        fetchFee()
    }, [tipoPedido, addressData.bairro])

    const total = subtotal + taxaEntrega

    const [formaPagamento, setFormaPagamento] = useState('pix')
    const [precisaTroco, setPrecisaTroco] = useState(false)
    const [trocoPara, setTrocoPara] = useState('')
    const [observacoes, setObservacoes] = useState('')
    const [nomeRetirada, setNomeRetirada] = useState(customer?.nome || '')
    const [telefoneMesa, setTelefoneMesa] = useState('')
    const [comandaDataLoaded, setComandaDataLoaded] = useState(false)

    // Auto-fill name/phone from existing comanda ("Pedir Mais" flow)
    useEffect(() => {
        async function loadComandaData() {
            const comandaId = localStorage.getItem('espetinho_comanda_id')
            if (tipoPedido !== 'mesa' || !comandaId) return

            const { data } = await supabase
                .from('pedidos')
                .select('nome_cliente, telefone_cliente')
                .eq('comanda_id', comandaId)
                .eq('pago', false)
                .order('criado_em', { ascending: true })
                .limit(1)

            if (data && data.length > 0) {
                const first = data[0]
                if (first.nome_cliente) setNomeRetirada(first.nome_cliente)
                if (first.telefone_cliente) {
                    let v = first.telefone_cliente.replace(/\D/g, '')
                    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
                    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`
                    setTelefoneMesa(v)
                }
                setComandaDataLoaded(true)
            }
        }
        loadComandaData()
    }, [tipoPedido])

    // Sync data when customer loads
    useEffect(() => {
        if (customer) {
            // Update name for pickup
            if (!nomeRetirada) setNomeRetirada(customer.nome)

            // Update delivery data if we have it in DB and local is empty or mismatch
            const dados = customer.dados || {}
            const dbAddr = dados.endereco || dados || {}

            const currentLocal = localStorage.getItem('espetinho_delivery_data')
            const noManualOverride = !localStorage.getItem('espetinho_manual_address')
            const isActuallyEmpty = !addressData.rua || !currentLocal

            if (dbAddr.rua || dados.nome_recebedor || dbAddr.google_maps_link) {
                if (isActuallyEmpty || noManualOverride) {
                    const newData = {
                        nome_recebedor: dados.nome_recebedor || dados.receiverName || dados.nome || customer.nome || '',
                        telefone_recebedor: (dados.whatsapp || dados.telefone_recebedor || dados.receiverPhone || customer.telefone || '').replace(/@s.whatsapp.net/g, ''),
                        rua: dbAddr.rua || dbAddr.street || dbAddr.logradouro || '',
                        numero: dbAddr.numero || dbAddr.number || '',
                        bairro: dbAddr.bairro || dbAddr.neighborhood || '',
                        referencia: dbAddr.referencia || dbAddr.reference || dbAddr.ponto_referencia || '',
                        google_maps_link: dbAddr.google_maps_link || ''
                    }

                    const isDifferent = JSON.stringify(newData) !== JSON.stringify(addressData)
                    if (isDifferent) {
                        localStorage.setItem('espetinho_delivery_data', JSON.stringify(newData))
                        setAddressData(newData)
                    }
                }
            }
        }
    }, [customer]) // Only sync when customer loads, not on every addressData change



    const hasAddress = !!(addressData.rua && addressData.nome_recebedor)

    async function handleConfirm() {
        if (tipoPedido === 'entrega' && !hasAddress) {
            setValidationError({ open: true, message: 'Volte ao carrinho e preencha o endereço de entrega.' })
            return
        }

        if (tipoPedido === 'mesa' && !mesaId) {
            setValidationError({ open: true, message: 'Mesa não identificada. Escaneie o QR code novamente.' })
            return
        }

        if (tipoPedido === 'mesa' && nomeRetirada.trim().length < 2) {
            setValidationError({ open: true, message: 'Por favor, informe seu nome (mínimo 2 letras) para confirmar o pedido na mesa.' })
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
        }

        // Phone validation for mesa orders
        if (tipoPedido === 'mesa' && !telefoneMesa.replace(/\D/g, '').match(/^\d{10,11}$/)) {
            setValidationError({ open: true, message: 'Por favor, informe um telefone válido para o pedido na mesa.' })
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
        }

        // Name validation: robust heuristic for real names
        const nomeValidar = (tipoPedido === 'entrega' ? addressData?.nome_recebedor : nomeRetirada)?.trim() || ''
        const letras = nomeValidar.match(/[a-zA-ZÀ-ÿ]/g) || []
        const temVogal = /[aeiouáéíóúâêôãõàèìòùAEIOUÁÉÍÓÚÂÊÔÃÕÀÈÌÒÙ]/u.test(nomeValidar)
        const temConsoante = /[^aeiouáéíóúâêôãõàèìòùAEIOUÁÉÍÓÚÂÊÔÃÕÀÈÌÒÙ\s\d\W]/u.test(nomeValidar)
        const somenteRepetido = letras.length > 0 && new Set(letras.map(l => l.toLowerCase())).size === 1
        const nomeInvalido = letras.length < 2 || !temVogal || !temConsoante || somenteRepetido
        if (nomeInvalido) {
            setValidationError({ open: true, message: 'Por favor, insira seu nome correto.' })
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
        }

        if (isSubmitting || submitLockRef.current) return
        submitLockRef.current = true
        setIsSubmitting(true)

        // Stock & Options validation: check if all cart items and options are still available
        try {
            const productIds = [...new Set(items.map(i => i.produto_id))]
            const { data: freshProducts } = await supabase
                .from('produtos')
                .select('id, nome, disponivel, controlar_estoque, quantidade_disponivel, opcoes_personalizacao')
                .in('id', productIds)

            if (freshProducts) {
                const unavailable = freshProducts.filter(p =>
                    !p.disponivel || (p.controlar_estoque && p.quantidade_disponivel <= 0)
                )

                if (unavailable.length > 0) {
                    const unavailableNames = unavailable.map(p => p.nome)
                    const unavailableIds = new Set(unavailable.map(p => p.id))

                    // Remove out-of-stock items from cart
                    items.forEach(item => {
                        if (unavailableIds.has(item.produto_id)) {
                            removeItem(item)
                        }
                    })

                    setOutOfStockItems(unavailableNames)
                    setShowOutOfStockModal(true)
                    setIsSubmitting(false)
                    submitLockRef.current = false
                    return
                }

                // Sanitizar opcoes_personalizacao de cada item do carrinho contra os produtos do banco
                const prodMap = new Map(freshProducts.map(p => [p.id, p]))

                items.forEach(item => {
                    const freshP = prodMap.get(item.produto_id)
                    if (!freshP || !item.personalizacao || typeof item.personalizacao !== 'object') return

                    const validOpts = new Set()
                    const defaultsByGroup = {}

                    if (Array.isArray(freshP.opcoes_personalizacao)) {
                        freshP.opcoes_personalizacao.forEach(g => {
                            if (g.padrao) defaultsByGroup[g.grupo] = g.padrao
                            if (Array.isArray(g.opcoes)) {
                                g.opcoes.forEach(o => {
                                    const oName = typeof o === 'string' ? o : (o.nome || o.name)
                                    const isAvail = typeof o === 'string' ? true : (o.disponivel !== false)
                                    if (oName && isAvail) {
                                        validOpts.add(oName.trim().toLowerCase())
                                    }
                                })
                            }
                        })
                    }

                    if (validOpts.size > 0) {
                        const newPersonalizacao = { ...item.personalizacao }
                        let modified = false

                        for (const [groupName, val] of Object.entries(newPersonalizacao)) {
                            if (Array.isArray(val)) {
                                const filtered = val.filter(v => typeof v === 'string' && validOpts.has(v.trim().toLowerCase()))
                                if (filtered.length !== val.length) {
                                    newPersonalizacao[groupName] = filtered
                                    modified = true
                                }
                            } else if (typeof val === 'string') {
                                if (!validOpts.has(val.trim().toLowerCase())) {
                                    // Se a opção antiga não existe mais, substitui pela padrão do grupo (se houver) ou remove
                                    if (defaultsByGroup[groupName] && validOpts.has(defaultsByGroup[groupName].trim().toLowerCase())) {
                                        newPersonalizacao[groupName] = defaultsByGroup[groupName]
                                    } else {
                                        delete newPersonalizacao[groupName]
                                    }
                                    modified = true
                                }
                            }
                        }

                        if (modified) {
                            item.personalizacao = newPersonalizacao
                        }
                    }
                })
            }
        } catch (stockErr) {
            // Non-blocking: if stock check fails, proceed with order anyway
            console.warn('[Stock Check] Erro ao verificar estoque, continuando...', stockErr)
        }

        try {
            const nomeCliente = (tipoPedido === 'mesa'
                ? (nomeRetirada || `Mesa ${mesaNumero}`)
                : tipoPedido === 'retirada'
                    ? nomeRetirada
                    : (addressData.nome_recebedor || '')).trim()

            let comandaId = localStorage.getItem('espetinho_comanda_id')
            if (tipoPedido === 'mesa' && !comandaId) {
                comandaId = crypto.randomUUID()
                localStorage.setItem('espetinho_comanda_id', comandaId)
            }

            const orderData = {
                nome_cliente: nomeCliente,
                telefone_cliente: tipoPedido === 'mesa' ? telefoneMesa.replace(/\D/g, '') : (addressData.telefone_recebedor || ''),
                tipo_pedido: tipoPedido,
                subtotal,
                taxa_entrega: taxaEntrega,
                valor_total: total,
                forma_pagamento: tipoPedido === 'mesa' ? 'pagar_na_mesa' : formaPagamento,
                metodo_pagamento: tipoPedido === 'mesa' ? 'pagar_na_mesa' : formaPagamento,
                troco_para: precisaTroco ? parseFloat(trocoPara) : null,
                endereco: tipoPedido === 'entrega' ? addressData : null,
                observacoes: tipoPedido === 'mesa' ? `Mesa ${mesaNumero}${observacoes ? ' | ' + observacoes : ''}` : observacoes,
                mesa_id: mesaId || null,
                comanda_id: comandaId || null,
                pago: false,
                comanda_status: comandaId ? 'aberta' : null,
                itens: items,
                cliente_id: tipoPedido === 'mesa' ? null : (customer?.id || null),
                codigo_cliente: tipoPedido === 'mesa' ? null : customerCode
            }

            const summary = items.map(item => {
                let name = `${item.quantidade}x ${item.nome || 'Item'}`
                if (item.personalizacao) {
                    const extras = Object.values(item.personalizacao)
                        .flat()
                        .filter(v => typeof v === 'string' && v.length > 0)
                        .join(', ')
                    if (extras) name += ` (${extras})`
                }
                return name
            }).join(', ')
            const pedido = await createOrder(orderData)

            // Sync comanda_id from the server (may have been adopted from an existing table order)
            if (pedido.comanda_id) {
                localStorage.setItem('espetinho_comanda_id', pedido.comanda_id)
            }

            const targetClientId = pedido.cliente_id || customer?.id

            if (tipoPedido !== 'mesa' && targetClientId) {
                await updateLastOrder(
                    `Pedido #${pedido.numero_pedido || pedido.id.slice(0, 5)}: ${summary}`,
                    tipoPedido === 'entrega' ? addressData : null,
                    targetClientId,
                    { nome: orderData.nome_cliente }
                )
            }

            // Webhook notification (espetinho domain) - Using timeout to prevent infinite loop on Android
            try {
                const webhookBody = {
                    ...orderData,
                    ...pedido, // Overwrites initial nulls with actual DB values (like cliente_id, comanda_id)
                    cliente_original: customer
                }

                await fetch('https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/pedido_feito', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookBody),
                    signal: AbortSignal.timeout(5000)
                }).catch(err => console.warn('N8N webhook taking too long or failed, skipping...', err))

                // If it's delivery, notify all drivers via OneSignal
                if (tipoPedido === 'entrega') {
                    console.log('[Notification] Triggering notify-driver for new order...')
                    const enderecoBairro = typeof addressData === 'object' ? (addressData.bairro || '') : ''
                    supabase.functions.invoke('notify-driver', {
                        body: {
                            numero_pedido: pedido.numero_pedido,
                            nome_cliente: orderData.nome_cliente,
                            endereco_bairro: enderecoBairro,
                            valor_total: orderData.valor_total,
                            tipo_notificacao: 'novo_pedido'
                        }
                    }).then(({ error }) => {
                        if (error) console.error('[Notification] Error calling notify-driver:', error)
                        else console.log('[Notification] Driver notification sent successfully')
                    })
                }
            } catch (webhookErr) {
                console.error('Erro ao enviar webhook/notificação:', webhookErr)
            }

            clearCart()
            submitLockRef.current = false
            localStorage.setItem('espetinho_ultimo_pedido_id', pedido.id)
            navigate(customerCode ? `/${customerCode}/pedido/${pedido.id}` : `/pedido/${pedido.id}`)
        } catch (err) {
            alert('Erro ao confirmar pedido: ' + err.message)
            setIsSubmitting(false)
            submitLockRef.current = false
        }
    }

    if (items.length === 0) {
        return (
            <div className="checkout-empty animate-fade-in">
                <span className="checkout-empty__icon">🛒</span>
                <h2>Nenhum item no carrinho</h2>
                <p>Adicione itens antes de finalizar o pedido.</p>
                <button className="btn btn-primary btn-md" onClick={() => navigate(customerCode ? `/${customerCode}` : '/')}>
                    Ver Cardápio
                </button>
            </div>
        )
    }

    return (
        <div className="checkout-page animate-fade-in">
            {/* Header */}
            <header className="checkout-header">
                <button
                    type="button"
                    className="checkout-header__back"
                    onClick={() => navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')}
                >
                    <ArrowLeft size={22} />
                </button>
                <h1>Confirmar Pedido</h1>
                <div style={{ width: 40 }} />
            </header>

            <main className="checkout-main">
                {/* Mesa Badge */}
                {tipoPedido === 'mesa' && (
                    <div className="checkout-mesa-badge">
                        <span>🍽️</span>
                        <strong>Mesa {mesaNumero}</strong>
                        <small>Pedido na mesa</small>
                    </div>
                )}

                {/* Delivery / Pickup Toggle (hide for mesa) */}
                {tipoPedido !== 'mesa' && (
                    <div className="checkout-toggle">
                        <button
                            className={`checkout-toggle__btn ${tipoPedido === 'entrega' ? 'checkout-toggle__btn--active' : ''}`}
                            onClick={() => setTipoPedido('entrega')}
                        >
                            <span>🛵</span> Entrega
                        </button>
                        <button
                            className={`checkout-toggle__btn ${tipoPedido === 'retirada' ? 'checkout-toggle__btn--active' : ''}`}
                            onClick={() => setTipoPedido('retirada')}
                        >
                            <span>🏪</span> Retirada
                        </button>
                    </div>
                )}

                {/* Pickup / Mesa Name — hide if comanda already has data */}
                {(tipoPedido === 'retirada' || (tipoPedido === 'mesa' && !comandaDataLoaded)) && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <User size={20} color="var(--cor-primaria)" /> {tipoPedido === 'mesa' ? 'Qual é o seu nome?' : 'Quem vai retirar?'}
                        </h2>
                        <div className="checkout-card">
                            <div className="checkout-field">
                                <input
                                    ref={nomeInputRef}
                                    type="text"
                                    placeholder={tipoPedido === 'mesa' ? "Digite seu nome (obrigatório)" : "Nome de quem vai buscar"}
                                    value={nomeRetirada}
                                    maxLength={60}
                                    onChange={e => {
                                        const raw = e.target.value
                                        // Auto-capitalize: first letter of each word
                                        const capitalized = raw.replace(/(?:^|\s)\S/g, c => c.toUpperCase())
                                        setNomeRetirada(capitalized)
                                    }}
                                    className="checkout-input"
                                />
                            </div>
                            {tipoPedido === 'mesa' && (
                                <div className="checkout-field" style={{ marginTop: '12px' }}>
                                    <input
                                        type="tel"
                                        placeholder="Telefone / WhatsApp (obrigatório)"
                                        value={telefoneMesa}
                                        onChange={e => {
                                            let v = e.target.value.replace(/\D/g, '')
                                            if (v.length > 11) v = v.slice(0, 11)
                                            if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
                                            else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`
                                            setTelefoneMesa(v)
                                        }}
                                        className="checkout-input"
                                        inputMode="tel"
                                    />
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Delivery Address Review (read-only, from localStorage) */}
                {tipoPedido === 'entrega' && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <MapPin size={20} color="var(--cor-primaria)" /> Entregar em
                        </h2>
                        {hasAddress ? (
                            <div className="checkout-address-card">
                                <div className="checkout-address-card__info">
                                    <p className="checkout-address-card__street">
                                        {addressData.rua}, {addressData.numero}
                                    </p>
                                    <p className="checkout-address-card__neighborhood">
                                        {addressData.bairro}
                                    </p>
                                    {addressData.referencia && (
                                        <p className="checkout-address-card__ref">
                                            📍 {addressData.referencia}
                                        </p>
                                    )}
                                    <div className="checkout-address-card__receiver">
                                        <div className="checkout-address-card__receiver-group">
                                            <div className="checkout-address-card__receiver-item">
                                                <span className="receiver-item-icon"><User size={14} /></span>
                                                <span className="receiver-item-text">{addressData.nome_recebedor}</span>
                                            </div>
                                            <div className="checkout-address-card__receiver-item">
                                                <span className="receiver-item-icon" style={{ fontSize: '14px' }}>📱</span>
                                                <span className="receiver-item-text">{addressData.telefone_recebedor.replace(/@s.whatsapp.net/g, '')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="checkout-address-card__edit"
                                    onClick={() => navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')}
                                >
                                    <Edit3 size={16} />
                                    Editar
                                </button>
                            </div>
                        ) : (
                            <div className="checkout-address-empty" onClick={() => navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')}>
                                <MapPin size={24} />
                                <p>Nenhum endereço cadastrado</p>
                                <span>Toque para adicionar</span>
                            </div>
                        )}
                    </section>
                )}

                {/* Payment Method (hide for mesa - payment is at the table) */}
                {tipoPedido !== 'mesa' && (
                    <section className="checkout-section">
                        <h2 className="checkout-section__title">
                            <CreditCard size={20} color="var(--cor-primaria)" /> Forma de Pagamento
                        </h2>
                        <div className="checkout-card">
                            <div className="checkout-payment-options">
                                <label className={`checkout-payment ${formaPagamento === 'pix' ? 'checkout-payment--active' : ''}`}>
                                    <input type="radio" name="pagamento" checked={formaPagamento === 'pix'} onChange={() => setFormaPagamento('pix')} />
                                    <span>💠 PIX</span>
                                </label>
                                <label className={`checkout-payment ${formaPagamento === 'cartao_entrega' ? 'checkout-payment--active' : ''}`}>
                                    <input type="radio" name="pagamento" checked={formaPagamento === 'cartao_entrega'} onChange={() => setFormaPagamento('cartao_entrega')} />
                                    <span>💳 Cartão (Entrega)</span>
                                </label>
                                <label className={`checkout-payment ${formaPagamento === 'dinheiro' ? 'checkout-payment--active' : ''}`}>
                                    <input type="radio" name="pagamento" checked={formaPagamento === 'dinheiro'} onChange={() => setFormaPagamento('dinheiro')} />
                                    <span>💵 Dinheiro</span>
                                </label>
                            </div>
                            {formaPagamento === 'dinheiro' && (
                                <div className="checkout-change">
                                    <label className="checkout-change__check">
                                        <input type="checkbox" checked={precisaTroco} onChange={e => setPrecisaTroco(e.target.checked)} />
                                        <span>Precisa de troco?</span>
                                    </label>
                                    {precisaTroco && (
                                        <input type="text" placeholder="Troco para quanto?" value={trocoPara} onChange={e => setTrocoPara(e.target.value)} className="checkout-change__input" />
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Order Summary */}
                <section className="checkout-section">
                    <h2 className="checkout-section__title">
                        <Receipt size={20} color="var(--cor-primaria)" /> Resumo do Pedido
                    </h2>
                    <div className="checkout-card">
                        <div className="checkout-items">
                            {items.map(item => {
                                const key = `${item.produto_id}-${item.variacao_id || 'default'}-${item.observacoes || ''}`
                                return (
                                    <div key={key} className="checkout-item">
                                        <div className="checkout-item__img">
                                            <img src={getImageUrl(item.imagem_url) || 'https://via.placeholder.com/60?text=🍖'} alt={item.nome} />
                                        </div>
                                        <div className="checkout-item__info">
                                            <div className="checkout-item__top">
                                                <h4>{item.nome}</h4>
                                                <span>{formatCurrency(item.preco * item.quantidade)}</span>
                                            </div>
                                            {item.personalizacao && typeof item.personalizacao === 'object' && (() => {
                                                const filtered = filterPersonalizacao(item.personalizacao, item.nome)
                                                return filtered.length > 0 && (
                                                    <div className="checkout-item__details">
                                                        {filtered.map(({ key, value }) => (
                                                            <p key={key} className="checkout-item__detail">
                                                                <strong>{key}:</strong> {value}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )
                                            })()}

                                            {item.observacoes && (
                                                <p className="checkout-item__obs" style={{ color: 'var(--cor-destaque)', fontWeight: '500' }}>
                                                    OBS: {item.observacoes}
                                                </p>
                                            )}
                                            {!item.observacoes && item.descricao && (
                                                <p className="checkout-item__desc">{item.descricao}</p>
                                            )}
                                            <span className="checkout-item__qty">{item.quantidade}x</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="checkout-totals">
                            <div className="checkout-totals__row">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {tipoPedido === 'entrega' && (
                                <div className="checkout-totals__row">
                                    <span>Taxa de Entrega</span>
                                    <span>{formatCurrency(taxaEntrega)}</span>
                                </div>
                            )}
                            <div className="checkout-totals__total">
                                <span>Total</span>
                                <span className="checkout-totals__value">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* CTA */}
            <div className="checkout-footer">
                <button
                    className="checkout-footer__btn"
                    onClick={handleConfirm}
                    disabled={
                        loading ||
                        isSubmitting ||
                        (tipoPedido === 'entrega' && !hasAddress) ||
                        (tipoPedido === 'entrega' && taxaEntrega <= 0) ||
                        (tipoPedido === 'retirada' && !nomeRetirada.trim()) ||
                        (tipoPedido === 'mesa' && !mesaId)
                    }
                >
                    {loading || isSubmitting ? (
                        <span className="btn-spinner" />
                    ) : (tipoPedido === 'entrega' && taxaEntrega <= 0) ? (
                        <>
                            <CheckCircle size={18} style={{ marginRight: 8 }} />
                            Frete indisponível (Confirme o Endereço)
                        </>
                    ) : (
                        <>
                            <CheckCircle size={18} style={{ marginRight: 8 }} />
                            Confirmar Pedido {formatCurrency(total)}
                        </>
                    )}
                </button>
            </div>

            {/* VALIDATION ERROR MODAL */}
            {validationError.open && (
                <div className="modal-backdrop" onClick={() => setValidationError({ open: false, message: '' })} style={{ zIndex: 10000 }}>
                    <div className="bottom-sheet validation-modal" onClick={e => e.stopPropagation()}>
                        <div className="bottom-sheet__handle" />
                        <div className="validation-content">
                            <div className="validation-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                                <AlertTriangle size={48} />
                            </div>
                            <h3>Atenção</h3>
                            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                                {validationError.message}
                            </p>
                            <button
                                className="btn btn-primary btn-md btn-full"
                                onClick={() => {
                                    setValidationError({ open: false, message: '' })
                                    // Focus name input so user knows exactly where to fix
                                    setTimeout(() => {
                                        nomeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                        nomeInputRef.current?.focus()
                                    }, 150)
                                }}
                            >
                                Corrigir nome
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OUT OF STOCK MODAL */}
            <OutOfStockModal
                isOpen={showOutOfStockModal}
                onClose={() => setShowOutOfStockModal(false)}
                items={outOfStockItems}
            />
        </div>
    )
}
