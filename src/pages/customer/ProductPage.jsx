import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Heart, Minus, Plus, Check, ShoppingCart } from 'lucide-react'
import { useProducts, useProduct } from '../../hooks/useProducts'
import { useCart } from '../../hooks/useCart'
import { useFavorites } from '../../hooks/useFavorites'
import { formatCurrency, getImageUrl, getSmartItemName } from '../../lib/utils'
import { optimizeUrl } from '../../lib/cloudinary'
import Loading from '../../components/ui/Loading'
import OptimizedImage from '../../components/ui/OptimizedImage'
import StockWarningModal from '../../components/customer/StockWarningModal'
import './ProductPage.css'

// Helper: normalize option to always get the name string
const optName = (opt) => (typeof opt === 'string' ? opt : opt.nome || opt.name)
const optPreco = (opt) => {
    if (typeof opt === 'string') return 0
    // Try both Porto and English keys, and ensure it's a number
    const val = opt.preco !== undefined ? opt.preco : opt.price
    return Number(val) || 0
}
const optImg = (opt) => (typeof opt === 'string' ? null : opt.imagem_url || opt.image_url || null)

// Helper: Get clean product name for display (strips current size in parenthesis if variation is selected)
function getDisplayName(baseName, selectedVariation) {
    if (!selectedVariation) return baseName
    // Strip parenthetical from both base and variation name
    const cleanBase = baseName.replace(/\s*\(.*?\)\s*/g, ' ').trim()
    const cleanVar = selectedVariation.nome.replace(/\s*\(.*?\)\s*$/, '').trim()
    return `${cleanBase} - ${cleanVar}`
}

// Helper: Format name to make text inside parentheses smaller
const formatNameWithAccessories = (name) => {
    if (!name) return name
    const parts = name.split(/(\(.*?\))/g)
    return parts.map((part, i) => {
        if (part.startsWith('(') && part.endsWith(')')) {
            return <span key={i} className="product-name-accessories">{part}</span>
        }
        return part
    })
}

export default function ProductPage() {
    const { id, customerCode } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { product, loading } = useProduct(id)
    const { products } = useProducts()
    const isUpsell = searchParams.get('upsell') === 'true'
    const { addItem, items: cartItems } = useCart()
    const cartCount = cartItems.reduce((sum, i) => sum + i.quantidade, 0)
    const { liked, toggleLike, animatingHearts } = useFavorites()

    const checkOptionAvailable = useCallback((opt) => {
        let isAvailable = typeof opt === 'string'
            ? true
            : (opt.disponivel !== false && (!opt.controlar_estoque || opt.quantidade_disponivel > 0))

        if (!isAvailable) return false;

        const rawName = typeof opt === 'string' ? opt : (opt.nome || opt.name);
        if (!rawName) return true;
        const nameStr = String(rawName).toLowerCase();

        // New global check for Açaí products
        // If the current product is Açaí, verify if this option is disabled in ANY açaí product's groups
        const catName = product?.categoria?.nome || product?.categorias?.nome;
        if (catName === 'Açaí' && products?.length > 0) {
            for (const p of products) {
                const pCat = p.categoria?.nome || p.categorias?.nome;
                if (pCat === 'Açaí' && p.opcoes_personalizacao) {
                    for (const g of p.opcoes_personalizacao) {
                        if (['Escolha 2 Frutas (Inclusos)', 'Adicionais (Pagos)', 'Acompanha'].includes(g.grupo)) {
                            const match = g.opcoes.find(o => {
                                const pName = typeof o === 'string' ? o : (o.nome || o.name);
                                return String(pName).toLowerCase() === nameStr;
                            });
                            if (match && typeof match !== 'string' && match.disponivel === false) {
                                return false; // Found explicitly disabled globally
                            }
                        }
                    }
                }
            }
        }

        if (products?.length > 0) {
            // Find an exact match in the catalog safely
            const matchingProduct = products.find(p => p?.nome && String(p.nome).toLowerCase() === nameStr && p.id !== product?.id);
            if (matchingProduct) {
                const globalAvailable = matchingProduct.disponivel !== false && (!matchingProduct.controlar_estoque || matchingProduct.quantidade_disponivel > 0);
                if (!globalAvailable) return false;
            }
        }
        return true;
    }, [products, product?.id]);

    const [qty, setQty] = useState(1)
    const [notes, setNotes] = useState('')
    const [stockWarning, setStockWarning] = useState({ open: false, product: '', qty: 0 })
    const [selectedVariation, setSelectedVariation] = useState(null)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [disabledGroups, setDisabledGroups] = useState(new Set())

    // Pre-select 300ml variation for Açaí or 500ml for Caldos on load
    useEffect(() => {
        if (product?.variacoes_produto?.length > 0) {
            if (product.nome?.toLowerCase().includes('caldo')) {
                const v300 = product.variacoes_produto.find(v => v.nome === '300ml')
                const v500 = product.variacoes_produto.find(v => v.nome === '500ml')
                if (v500) setSelectedVariation(v500)
                else if (v300) setSelectedVariation(v300)
            } else if (product.categoria?.nome === 'Espetinhos' || product.nome?.toLowerCase().includes('espetinho') || product.nome?.toLowerCase().includes('medalhão') || product.nome?.toLowerCase().includes('carne')) {
                // Skewers: find "Completo" variation
                const vCompleto = product.variacoes_produto.find(v => v.nome.toLowerCase().includes('completo'))
                if (vCompleto) setSelectedVariation(vCompleto)
                else setSelectedVariation(product.variacoes_produto[0]) // Fallback to first if no "Completo" found
            } else {
                // Default to 300ml for others if exists (like Açaí)
                const v300 = product.variacoes_produto.find(v => v.nome === '300ml')
                if (v300) setSelectedVariation(v300)
            }
        }
    }, [product])

    // Scroll to top on product change
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [id])

    // Initialize defaults from product customization data
    const hasInitializedDefaults = useRef(false)
    const lastProductId = useRef(null)
    useEffect(() => {
        if (!product?.opcoes_personalizacao) return
        // Only initialize defaults once per product
        if (lastProductId.current === product.id && hasInitializedDefaults.current) return
        lastProductId.current = product.id
        hasInitializedDefaults.current = true

        const defaults = {}
        const isEspetinho = product.categoria?.nome === 'Espetinhos' || product.nome?.toLowerCase().includes('espetinho')

        product.opcoes_personalizacao.forEach(group => {
            if (group.padrao) {
                defaults[group.grupo] = group.padrao
            } else if (group.tipo === 'checkbox') {
                if (isEspetinho) {
                    // Pré-selecionar automaticamente os acompanhamentos gratuitos/inclusos
                    const inclusos = group.opcoes
                        .filter(opt => optPreco(opt) === 0 && checkOptionAvailable(opt))
                        .map(opt => optName(opt))
                    defaults[group.grupo] = inclusos
                } else {
                    defaults[group.grupo] = []
                }
            } else {
                // Radio option: if there's only 1 available option, pre-select it automatically
                const availableOpts = group.opcoes.filter(opt => checkOptionAvailable(opt))
                if (availableOpts.length === 1) {
                    defaults[group.grupo] = optName(availableOpts[0])
                } else {
                    defaults[group.grupo] = ''
                }
            }
        })
        setSelectedOptions(defaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product])

    // Sync accompaniment/arroz groups when variation changes
    useEffect(() => {
        if (!selectedVariation || !product?.opcoes_personalizacao) return

        // Only apply this restriction logic if the product actually HAS a "Completo" variation (e.g., Espetinhos)
        // For Açai, Drinks, etc. where there is no "Completo", this restriction should not apply
        const hasCompletoVariation = product.variacoes_produto?.some(
            v => v.nome.toLowerCase().includes('completo')
        )

        if (!hasCompletoVariation) {
            setDisabledGroups(new Set())
            return
        }

        const variationName = selectedVariation.nome || ''
        const varLower = variationName.toLowerCase()
        const isCompleto = varLower.includes('completo')

        // Find accompaniment and arroz-type groups
        const inclusionKeywords = ['acompanha', 'incluso', 'acompanhamento', 'complemento', 'complementos']
        const arrozKeywords = ['arroz', 'tipo de arroz']

        const accompGroup = product.opcoes_personalizacao.find(g =>
            inclusionKeywords.some(kw => g.grupo.toLowerCase().includes(kw))
        )
        const arrozGroup = product.opcoes_personalizacao.find(g =>
            arrozKeywords.some(kw => g.grupo.toLowerCase().includes(kw))
        )

        if (isCompleto) {
            // Completo → enable all groups, select all accompaniments
            setDisabledGroups(new Set())
            if (accompGroup) {
                // Determine which options are actually available
                const availableOptions = accompGroup.opcoes.filter(opt => checkOptionAvailable(opt)).map(opt => optName(opt))

                setSelectedOptions(prev => {
                    // Selecionar TODOS os acompanhamentos gratuitos e disponíveis (não apenas o padrao)
                    const freeAvailable = accompGroup.opcoes
                        .filter(opt => {
                            const isAvail = checkOptionAvailable(opt)
                            const isFree = optPreco(opt) === 0
                            return isAvail && isFree
                        })
                        .map(opt => optName(opt))

                    let defaultsToUse = freeAvailable.length > 0 ? freeAvailable : [...availableOptions]

                    return {
                        ...prev,
                        [accompGroup.grupo]: defaultsToUse
                    }
                })
            }
            if (arrozGroup) {
                // Force Arroz selection to be blank initially so the user has to click
                setSelectedOptions(prev => ({
                    ...prev,
                    [arrozGroup.grupo]: arrozGroup.tipo === 'radio' ? '' : []
                }))
            }
        } else {
            // Non-Completo → disable and clear accomp + arroz groups
            const groupsToDisable = new Set()
            const optionUpdates = {}

            if (accompGroup) {
                groupsToDisable.add(accompGroup.grupo)
                optionUpdates[accompGroup.grupo] = []
            }
            if (arrozGroup) {
                groupsToDisable.add(arrozGroup.grupo)
                optionUpdates[arrozGroup.grupo] = arrozGroup.tipo === 'radio' ? '' : []
            }

            setDisabledGroups(groupsToDisable)
            setSelectedOptions(prev => ({ ...prev, ...optionUpdates }))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVariation, product?.id])

    // Detect if a radio group acts as a price-replacement (not an additive extra).
    // This is the case when the product has radio groups with prices > 0 and NO variations,
    // meaning the admin intended the radio option price to BE the item price.
    const hasPriceReplacementRadio = useMemo(() => {
        if (!product?.opcoes_personalizacao) return false
        const hasVariations = product.variacoes_produto?.length > 0
        if (hasVariations) return false
        return product.opcoes_personalizacao.some(g =>
            g.tipo === 'radio' && g.opcoes?.some(opt => optPreco(opt) > 0)
        )
    }, [product])

    // Calculate extras cost from selected add-on options
    const extrasTotal = useMemo(() => {
        if (!product?.opcoes_personalizacao) return 0
        let total = 0
        product.opcoes_personalizacao.forEach(group => {
            const selected = selectedOptions[group.grupo]
            // Skip radio groups that act as price-replacement (their price replaces the base, not adds)
            if (group.tipo === 'radio' && hasPriceReplacementRadio) {
                const hasGroupPrices = group.opcoes?.some(opt => optPreco(opt) > 0)
                if (hasGroupPrices) return // Skip this group entirely
            }
            group.opcoes.forEach(opt => {
                const name = optName(opt)
                const price = optPreco(opt)
                if (price <= 0) return
                if (group.tipo === 'radio' && selected === name) {
                    total += price
                } else if (Array.isArray(selected)) {
                    const count = selected.filter(item => item === name).length
                    total += price * count
                }
            })
        })
        return total
    }, [product, selectedOptions, hasPriceReplacementRadio])

    // Get the effective base price from a price-replacement radio group selection
    const radioBasePrice = useMemo(() => {
        if (!hasPriceReplacementRadio || !product?.opcoes_personalizacao) return null
        for (const group of product.opcoes_personalizacao) {
            if (group.tipo !== 'radio') continue
            const hasGroupPrices = group.opcoes?.some(opt => optPreco(opt) > 0)
            if (!hasGroupPrices) continue
            const selected = selectedOptions[group.grupo]
            if (!selected) continue
            const selectedOpt = group.opcoes.find(opt => optName(opt) === selected)
            if (selectedOpt) return optPreco(selectedOpt)
        }
        return null
    }, [hasPriceReplacementRadio, product, selectedOptions])

    const totalPrice = useMemo(() => {
        const basePrice = selectedVariation?.preco
            || (radioBasePrice !== null ? radioBasePrice : null)
            || product?.preco
            || 0
        return (basePrice + extrasTotal) * qty
    }, [product, selectedVariation, qty, extrasTotal, radioBasePrice])

    const customizations = product?.opcoes_personalizacao || []


    // Calculate the unit price (base + extras) for the header display
    const unitPrice = useMemo(() => {
        const basePrice = selectedVariation?.preco
            || (radioBasePrice !== null ? radioBasePrice : null)
            || product?.preco
            || 0
        return basePrice + extrasTotal
    }, [product, selectedVariation, extrasTotal, radioBasePrice])

    // Validation: check if all "Escolha X" groups have exactly X items
    // + when Completo is selected, arroz group is required
    const isSelectionValid = useMemo(() => {
        if (!product?.opcoes_personalizacao) return true

        // Check "Escolha X" groups
        const escolhaValid = product.opcoes_personalizacao.every(group => {
            const groupName = group.grupo?.toLowerCase() || ''
            if (groupName.includes('escolha')) {
                const match = groupName.match(/escolha\s*(\d+)/i)
                if (match) {
                    const required = parseInt(match[1])
                    const current = selectedOptions[group.grupo]
                    const selectedCount = Array.isArray(current) ? current.length : 0
                    return selectedCount === required
                }
            }
            return true
        })
        if (!escolhaValid) return false

        // When Completo is selected, arroz group is required
        const isCompleto = selectedVariation?.nome?.toLowerCase().includes('completo')
        if (isCompleto) {
            const arrozKeywords = ['arroz', 'tipo de arroz']
            const arrozGroup = product.opcoes_personalizacao.find(g =>
                arrozKeywords.some(kw => g.grupo.toLowerCase().includes(kw))
            )
            if (arrozGroup) {
                const arrozSelection = selectedOptions[arrozGroup.grupo]
                if (!arrozSelection || (Array.isArray(arrozSelection) && arrozSelection.length === 0)) {
                    return false
                }
            }
        }

        return true
    }, [product, selectedOptions, selectedVariation])

    if (loading) return <Loading fullScreen />
    if (!product) return <div className="page-padding" style={{ paddingTop: 80 }}>Produto não encontrado</div>

    function getOptionCount(groupName, optionName) {
        const current = selectedOptions[groupName]
        if (Array.isArray(current)) {
            return current.filter(o => o === optionName).length
        }
        return current === optionName ? 1 : 0
    }

    function handleOptionIncrement(group, optionName, e) {
        if (e) e.stopPropagation()
        const { grupo: groupName, tipo, maximo } = group

        if (tipo === 'radio') {
            setSelectedOptions(prev => ({ ...prev, [groupName]: optionName }))
            return
        }

        setSelectedOptions(prev => {
            const current = Array.isArray(prev[groupName]) ? prev[groupName] : []
            if (maximo && current.length >= maximo) return prev
            return { ...prev, [groupName]: [...current, optionName] }
        })
    }

    function handleOptionDecrement(group, optionName, e) {
        if (e) e.stopPropagation()
        const { grupo: groupName, tipo } = group

        if (tipo === 'radio') {
            setSelectedOptions(prev => ({ ...prev, [groupName]: '' }))
            return
        }

        setSelectedOptions(prev => {
            const current = Array.isArray(prev[groupName]) ? prev[groupName] : []
            const index = current.lastIndexOf(optionName)
            if (index === -1) return prev
            const newArr = [...current]
            newArr.splice(index, 1)
            return { ...prev, [groupName]: newArr }
        })
    }

    function handleOptionToggle(group, optionName) {
        const { grupo: groupName, tipo, maximo } = group
        setSelectedOptions(prev => {
            const current = prev[groupName] || (tipo === 'radio' ? '' : [])

            if (tipo === 'radio') {
                return { ...prev, [groupName]: current === optionName ? '' : optionName }
            }

            // checkbox
            const arr = Array.isArray(current) ? current : []
            if (arr.includes(optionName)) {
                return { ...prev, [groupName]: arr.filter(o => o !== optionName) }
            } else {
                // FIFO behavior: if maximo reached, remove oldest selection
                if (maximo && arr.length >= maximo) {
                    const newArr = [...arr.slice(1), optionName]
                    return { ...prev, [groupName]: newArr }
                }
                return { ...prev, [groupName]: [...arr, optionName] }
            }
        })
    }

    function isOptionSelected(groupName, optionName, tipo) {
        const current = selectedOptions[groupName]
        if (tipo === 'radio') return current === optionName
        return Array.isArray(current) && current.includes(optionName)
    }

    // Check if a group has any paid options
    function groupHasPaidOptions(group) {
        if (group.grupo?.toLowerCase().includes('pago')) return true
        return group.opcoes.some(opt => optPreco(opt) > 0)
    }


    const getValidationMessage = () => {
        const isEsgotado = !product?.disponivel || (product?.controlar_estoque && product?.quantidade_disponivel <= 0)
        if (isEsgotado) return 'Esgotado'

        if (!isSelectionValid && product?.opcoes_personalizacao) {
            const missingGroup = product.opcoes_personalizacao.find(group => {
                const groupName = group.grupo?.toLowerCase() || ''
                if (groupName.includes('escolha')) {
                    const match = groupName.match(/escolha\s*(\d+)/i)
                    if (match) {
                        const required = parseInt(match[1])
                        const current = selectedOptions[group.grupo]
                        const selectedCount = Array.isArray(current) ? current.length : 0
                        return selectedCount !== required
                    }
                }
                return false
            })
            if (missingGroup) {
                const groupName = missingGroup.grupo?.toLowerCase() || ''
                if (groupName.includes('fruta')) return 'Selecione as frutas'

                const match = groupName.match(/escolha\s*(\d+)/i)
                const required = match ? parseInt(match[1]) : 0
                const current = selectedOptions[missingGroup.grupo]
                const selectedCount = Array.isArray(current) ? current.length : 0
                const remaining = required - selectedCount

                if (remaining > 0) return `Escolha mais ${remaining} ${remaining === 1 ? 'item' : 'itens'}`
                return `Selecione ${required} itens`
            }
        }
        // Check arroz requirement for Completo
        const isCompletoVar = selectedVariation?.nome?.toLowerCase().includes('completo')
        if (isCompletoVar && product?.opcoes_personalizacao) {
            const arrozKeywords = ['arroz', 'tipo de arroz']
            const arrozGroup = product.opcoes_personalizacao.find(g =>
                arrozKeywords.some(kw => g.grupo.toLowerCase().includes(kw))
            )
            if (arrozGroup) {
                const arrozSelection = selectedOptions[arrozGroup.grupo]
                if (!arrozSelection || (Array.isArray(arrozSelection) && arrozSelection.length === 0)) {
                    return 'Escolha o tipo de arroz'
                }
            }
        }

        return 'Adicionar'
    }

    function getOptionStock(optName) {
        if (!optName || !products?.length) return null
        const nameLower = String(optName).trim().toLowerCase()
        const found = products.find(p => p?.nome && String(p.nome).trim().toLowerCase() === nameLower)
        if (found && found.controlar_estoque) {
            return found.quantidade_disponivel || 0
        }
        return null
    }

    function handleAdd(e) {
        // 1. Check main product stock
        if (product.controlar_estoque) {
            const currentInCart = cartItems
                .filter(i => i.produto_id === product.id)
                .reduce((sum, i) => sum + i.quantidade, 0)
            const totalRequested = currentInCart + qty
            if (totalRequested > product.quantidade_disponivel) {
                setStockWarning({
                    open: true,
                    productName: product.nome,
                    availableQty: Math.max(0, product.quantidade_disponivel - currentInCart)
                })
                return
            }
        }

        // 2. Check accompaniments / options stock
        for (const [, val] of Object.entries(selectedOptions)) {
            const selectedList = Array.isArray(val) ? val : [val]
            for (const optName of selectedList) {
                if (!optName || typeof optName !== 'string') continue
                const optStock = getOptionStock(optName)
                if (optStock !== null) {
                    let inCartCount = 0
                    cartItems.forEach(cartItem => {
                        if (!cartItem.personalizacao) return
                        Object.values(cartItem.personalizacao).forEach(pVal => {
                            const pList = Array.isArray(pVal) ? pVal : [pVal]
                            pList.forEach(name => {
                                if (typeof name === 'string' && name.trim().toLowerCase() === optName.trim().toLowerCase()) {
                                    inCartCount += (cartItem.quantidade || 1)
                                }
                            })
                        })
                    })

                    const requestedCount = inCartCount + (qty * 1)
                    if (requestedCount > optStock) {
                        setStockWarning({
                            open: true,
                            productName: optName,
                            availableQty: Math.max(0, optStock - inCartCount)
                        })
                        return
                    }
                }
            }
        }

        // Build options summary for display
        const optionsSummary = Object.entries(selectedOptions)
            .filter(([, val]) => (Array.isArray(val) ? val.length > 0 : val))
            .map(([grupo, val]) => `${grupo}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join(' | ')

        addItem({
            produto_id: product.id,
            variacao_id: selectedVariation?.id,
            nome: getSmartItemName(product.nome, selectedVariation?.nome, selectedOptions),
            preco: (selectedVariation?.preco || (radioBasePrice !== null ? radioBasePrice : product.preco)) + extrasTotal,
            imagem_url: product.imagem_url,
            quantidade: qty,
            observacoes: notes,
            personalizacao: selectedOptions,
            eh_upsell: isUpsell,
        })

        // --- Fly-to-Cart Animation ---
        const btn = e.currentTarget
        const rect = btn.getBoundingClientRect()
        // Try to find the cart icon in the header (ProductPage) or BottomNav (if visible)
        const cart = document.querySelector('.product-hero__cart-btn') || document.querySelector('.bottom-nav__cart-btn')

        if (cart) {
            const cartRect = cart.getBoundingClientRect()
            const fly = document.createElement('div')
            fly.className = 'fly-to-cart'
            fly.style.left = `${rect.left + rect.width / 2}px`
            fly.style.top = `${rect.top + rect.height / 2}px`
            fly.style.setProperty('--dx', `${cartRect.left + cartRect.width / 2 - (rect.left + rect.width / 2)}px`)
            fly.style.setProperty('--dy', `${cartRect.top + cartRect.height / 2 - (rect.top + rect.height / 2)}px`)
            document.body.appendChild(fly)

            fly.addEventListener('animationend', () => {
                fly.remove()
                cart.classList.add('cart-bounce')
                setTimeout(() => cart.classList.remove('cart-bounce'), 400)
            })
        }

        // --- Visual Feedback ---
        const originalText = btn.innerHTML
        btn.innerHTML = '<span>Adicionado!</span>'
        btn.classList.add('btn-success-temporary')
        setTimeout(() => {
            btn.innerHTML = originalText
            btn.classList.remove('btn-success-temporary')
        }, 2000)
    }

    return (
        <div className="product-page">
            <header className={`product-hero ${(!product.disponivel || (product.controlar_estoque && product.quantidade_disponivel <= 0)) ? 'product-hero--esgotado' : ''}`}>
                <OptimizedImage
                    src={getImageUrl(product.imagem_url) || 'https://via.placeholder.com/600x400?text=🍖'}
                    alt={product.nome}
                    className="product-hero__img"
                    width={600}
                    height={400}
                    priority={true}
                />
                <div className="product-hero__overlay" />
                <div className="product-hero__gradient" />
                {(!product.disponivel || (product.controlar_estoque && product.quantidade_disponivel <= 0)) && (
                    <div className="product-hero__out-badge">PRODUTO ESGOTADO</div>
                )}
                {/* Top Nav */}
                <div className="product-hero__nav">
                    <button className="product-hero__btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="product-hero__actions">
                        <button className="product-hero__btn product-hero__cart-btn" onClick={() => navigate(customerCode ? `/${customerCode}/carrinho` : '/carrinho')}>
                            <ShoppingCart size={20} />
                            {cartCount > 0 && <span className="product-hero__cart-badge">{cartCount}</span>}
                        </button>

                        <button
                            className={`product-hero__btn ${liked[product.id] ? 'product-hero__btn--liked' : ''}`}
                            onClick={() => toggleLike(product.id)}
                        >
                            <Heart
                                size={20}
                                fill={liked[product.id] ? '#ef4444' : 'none'}
                                color={liked[product.id] ? '#ef4444' : 'currentColor'}
                            />
                            {/* Heart burst animation */}
                            {animatingHearts[product.id] && (
                                <div className="heart-burst">
                                    {[...Array(6)].map((_, i) => (
                                        <span key={i} className="heart-burst__particle" style={{ '--i': i }}>❤</span>
                                    ))}
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="product-content">
                {/* Header Info */}
                <div className="product-info">
                    <h1 className="product-info__name">
                        {formatNameWithAccessories(getDisplayName(product.nome, selectedVariation))}
                    </h1>

                    {/* Tags conditionally rendered to avoid "too many highlights" */}
                    {(product.categoria?.nome === 'Espetinhos' || product.categoria?.nome === 'Açaí' || product.categoria?.nome === 'Caldos') && (
                        <div className="product-info__tags">
                            {/* Deterministic "Best Seller" for specific popular items */}
                            {(product.nome?.toLowerCase().includes('carne') || product.nome?.toLowerCase().includes('tradicional')) && (
                                <span className="product-info__tag product-info__tag--highlight">Mais Vendido</span>
                            )}

                            <div className="product-info__rating">
                                <span>⭐</span>
                                {/* Varied ratings based on product ID for a more realistic feel */}
                                <span>
                                    {4.7 + (product.id.charCodeAt(0) % 3) / 10} ({100 + (product.id.charCodeAt(product.id.length - 1) % 50)}+)
                                </span>
                            </div>
                        </div>
                    )}

                    <p className="product-info__desc">
                        {product.nome?.toLowerCase().includes('açaí tradicional') ? (
                            selectedVariation?.nome === '180ml'
                                ? 'Açaí Tradicional com Leite em pó e Tapioca.'
                                : 'Açaí Tradicional com Leite em pó, Leite condensado, Amendoim e Tapioca.'
                        ) : product.descricao}
                    </p>

                    <div className="product-info__price-container">
                        <div className="product-info__price">{formatCurrency(unitPrice)}</div>
                    </div>
                </div>

                <div className="product-divider" />

                {/* Variations */}
                {product.variacoes_produto?.length > 0 && (
                    <section className="product-section">
                        <div className="product-section__header">
                            <h3>Variações</h3>
                            <span className="product-section__badge">Escolha 1</span>
                        </div>
                        <div className="product-options">
                            {product.variacoes_produto
                                .filter(v => v.disponivel !== false && (!v.controlar_estoque || v.quantidade_disponivel > 0))
                                .map(v => (
                                    <label key={v.id} className={`product-option ${selectedVariation?.id === v.id ? 'product-option--selected' : ''}`}>
                                        <div className="product-option__left">
                                            <input
                                                type="radio"
                                                name="variacao"
                                                className="product-option__radio"
                                                checked={selectedVariation?.id === v.id}
                                                onChange={() => setSelectedVariation(v)}
                                            />
                                            <span className="product-option__label">
                                                {formatNameWithAccessories(v.nome)}
                                            </span>
                                        </div>
                                        <span className="product-option__price">{formatCurrency(v.preco)}</span>
                                    </label>
                                ))}
                        </div>
                    </section>
                )}

                {/* Customization Options */}
                {customizations.map((group, gIdx) => {
                    // Check if group has any available options
                    const availableOptions = group.opcoes.filter(opt => checkOptionAvailable(opt))

                    // Hide group if NO options are available
                    if (availableOptions.length === 0) return null

                    const hasPaid = groupHasPaidOptions(group)
                    const isOptional = group.tipo === 'radio'
                    const badgeText = hasPaid ? 'Selecione' : (isOptional ? 'Escolha 1' : 'Incluso')

                    const selectedValue = group.tipo === 'radio' ? selectedOptions[group.grupo] : null

                    return (
                        <section key={gIdx} className="product-section">
                            <div className="product-section__header">
                                <h3 className="product-section__title">
                                    {group.grupo}
                                    {selectedValue && <span className="product-section__selected-value">: {selectedValue}</span>}
                                </h3>
                                <span className={`product-section__badge ${hasPaid ? 'product-section__badge--paid' : ''}`}>
                                    {badgeText}
                                </span>
                            </div>
                            <div className="product-addons-list">
                                {group.opcoes.map((opt, oIdx) => {
                                    const name = optName(opt)
                                    const price = optPreco(opt)
                                    const img = optImg(opt)
                                    // Check availability
                                    const isAvailable = checkOptionAvailable(opt)

                                    if (!isAvailable) return null

                                    const count = getOptionCount(group.grupo, name)
                                    const selected = count > 0
                                    const isGroupDisabled = disabledGroups.has(group.grupo)
                                    const totalGroupItems = Array.isArray(selectedOptions[group.grupo]) ? selectedOptions[group.grupo].length : 0
                                    const isMaxReached = group.maximo ? totalGroupItems >= group.maximo : false

                                    return (
                                        <div
                                            key={oIdx}
                                            className={`product-addon-item ${selected ? 'product-addon-item--selected' : ''} ${isGroupDisabled ? 'product-addon-item--disabled' : ''}`}
                                            onClick={(e) => {
                                                if (isGroupDisabled) return
                                                if (group.tipo === 'radio') {
                                                    handleOptionToggle(group, name)
                                                } else if (count === 0) {
                                                    handleOptionIncrement(group, name, e)
                                                }
                                            }}
                                            style={isGroupDisabled ? { opacity: 0.4, pointerEvents: 'none' } : { cursor: 'pointer' }}
                                        >
                                            <div className="product-addon-item__left">
                                                <div className={`product-addon-item__check ${selected ? 'product-addon-item__check--active' : ''}`}>
                                                    {selected && <Check size={14} />}
                                                </div>
                                                {img && (
                                                    <OptimizedImage
                                                        src={getImageUrl(img)}
                                                        alt={name}
                                                        className="product-addon-item__img"
                                                        width={80}
                                                        height={80}
                                                    />
                                                )}
                                                <div className="product-addon-item__info">
                                                    <span className="product-addon-item__name">{name}</span>
                                                    {(() => {
                                                        if (group.tipo === 'radio') {
                                                            const showTotal = price > 0 || customizations.length === 1 || group.grupo === 'Tamanho'
                                                            if (showTotal) {
                                                                const isReplacementGroup = hasPriceReplacementRadio && group.opcoes?.some(o => optPreco(o) > 0)
                                                                const displayPrice = isReplacementGroup ? price : (product.preco || 0) + price
                                                                return (
                                                                    <span className="product-addon-item__price">
                                                                        {formatCurrency(displayPrice)}
                                                                    </span>
                                                                )
                                                            }
                                                            return null
                                                        }
                                                        return price > 0 && (
                                                            <span className="product-addon-item__price">+{formatCurrency(price)}</span>
                                                        )
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Quantity Controls for Checkbox / Multi-select Groups */}
                                            {group.tipo !== 'radio' && (
                                                <div className="product-addon-item__controls" onClick={(e) => e.stopPropagation()}>
                                                    {count > 0 ? (
                                                        <div className="product-addon-item__qty-box">
                                                            <button
                                                                type="button"
                                                                className="product-addon-item__qty-btn"
                                                                onClick={(e) => handleOptionDecrement(group, name, e)}
                                                                title="Diminuir"
                                                            >
                                                                <Minus size={13} />
                                                            </button>
                                                            <span className="product-addon-item__qty-count">{count}</span>
                                                            <button
                                                                type="button"
                                                                className="product-addon-item__qty-btn product-addon-item__qty-btn--plus"
                                                                onClick={(e) => handleOptionIncrement(group, name, e)}
                                                                disabled={isMaxReached}
                                                                title="Aumentar"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="product-addon-item__add-btn"
                                                            onClick={(e) => handleOptionIncrement(group, name, e)}
                                                            disabled={isMaxReached}
                                                            title="Adicionar"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    )
                })}

                {/* Observations */}
                <section className="product-section">
                    <h3>Alguma observação?</h3>
                    <textarea
                        className="product-notes"
                        placeholder={
                            product.nome.toLowerCase().includes('suco') || product.nome.toLowerCase().includes('refrigerante') || product.categoria_id === 'bebidas'
                                ? "Ex: Sem gelo, pouco açúcar..."
                                : product.nome.toLowerCase().includes('açaí')
                                    ? "Ex: Acompanhamentos separados, enviar colher..."
                                    : "Ex: Tirar a cebola, caprichar no sal..."
                        }
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                    />
                </section>
            </main>

            {/* Sticky Footer */}
            <div className="product-footer">
                <div className="product-footer__qty">
                    <button
                        className="product-footer__qty-btn"
                        onClick={() => setQty(Math.max(1, qty - 1))}
                        disabled={!product.disponivel || (product.controlar_estoque && product.quantidade_disponivel <= 0)}
                    >
                        <Minus size={16} />
                    </button>
                    <span className="product-footer__qty-value">{qty}</span>
                    <button
                        className="product-footer__qty-btn product-footer__qty-btn--plus"
                        onClick={() => {
                            if (product.controlar_estoque && qty >= product.quantidade_disponivel) {
                                setStockWarning({
                                    open: true,
                                    product: product.nome,
                                    qty: product.quantidade_disponivel
                                })
                                return
                            }
                            setQty(qty + 1)
                        }}
                        disabled={!product.disponivel || (product.controlar_estoque && product.quantidade_disponivel <= 0)}
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <button
                    className="product-footer__add"
                    onClick={handleAdd}
                    disabled={!product.disponivel || (product.controlar_estoque && product.quantidade_disponivel <= 0) || !isSelectionValid}
                    style={(!product.disponivel || (product.controlar_estoque && product.quantidade_disponivel <= 0) || !isSelectionValid) ? { background: '#9CA3AF', cursor: 'not-allowed' } : {}}
                >
                    <span>
                        {getValidationMessage()}
                        {isSelectionValid && ` ${formatCurrency(totalPrice)}`}
                    </span>
                </button>
            </div>

            {/* Stock Warning Modal */}
            <StockWarningModal
                isOpen={stockWarning.open}
                onClose={() => setStockWarning(prev => ({ ...prev, open: false }))}
                productName={stockWarning.product}
                availableQty={stockWarning.qty}
            />
        </div>
    )
}
