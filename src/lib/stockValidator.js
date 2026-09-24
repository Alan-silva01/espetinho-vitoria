/**
 * Stock Validator — Funções puras para validação de estoque de acompanhamentos.
 *
 * Extraídas da lógica do ProductPage.jsx para serem testáveis sem React/DOM.
 * Usadas para validar se um acompanhamento (arroz, etc.) tem estoque suficiente
 * antes de adicionar ao carrinho.
 */

/**
 * Normaliza string para comparação sem acento, sem pontuação e minúscula.
 * Ex: "Arroz Baião" -> "arroz baiao"
 */
function normalizeText(text) {
    if (!text) return ''
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
}

/**
 * Busca o estoque disponível de uma opção (ex: "Arroz Baião") no catálogo de produtos
 * ou dentro das opções de personalização (ex: opcoes_personalizacao de um produto).
 * Retorna null se não houver controle de estoque definido.
 * Suporta correspondência exata ou normalizada/insensível a acentuação e substring.
 *
 * @param {string} optionName - Nome da opção (ex: "Arroz Baião")
 * @param {Array} [products] - Lista de produtos do catálogo
 * @param {Object|Array} [productOrOptions] - Produto atual ou lista de opções/grupos de personalização
 * @returns {number|null} - Quantidade disponível ou null se sem controle
 */
export function getOptionStock(optionName, products = [], productOrOptions = null) {
    if (!optionName) return null
    const nameNorm = normalizeText(optionName)
    if (!nameNorm) return null

    // 1. Verificar em productOrOptions (opcoes_personalizacao do produto)
    if (productOrOptions) {
        let groups = []
        if (Array.isArray(productOrOptions)) {
            // Pode ser um array de grupos ou array de opções
            groups = productOrOptions
        } else if (productOrOptions.opcoes_personalizacao && Array.isArray(productOrOptions.opcoes_personalizacao)) {
            groups = productOrOptions.opcoes_personalizacao
        }

        for (const g of groups) {
            // Se o item for um grupo com 'opcoes'
            const opts = Array.isArray(g?.opcoes) ? g.opcoes : (g?.nome ? [g] : [])
            for (const opt of opts) {
                const oName = typeof opt === 'string' ? opt : (opt?.nome || opt?.name)
                if (!oName) continue
                const oNorm = normalizeText(oName)
                if (oNorm === nameNorm || oNorm.includes(nameNorm) || nameNorm.includes(oNorm)) {
                    if (typeof opt === 'object' && opt !== null) {
                        if (opt.quantidade !== undefined && opt.quantidade !== null && opt.quantidade !== '') {
                            return Number(opt.quantidade)
                        }
                        if (opt.quantidade_disponivel !== undefined && opt.quantidade_disponivel !== null) {
                            return Number(opt.quantidade_disponivel)
                        }
                    }
                }
            }
        }
    }

    // 2. Verificar no catálogo de produtos (se for produto separado ou se os produtos tiverem opcoes_personalizacao)
    if (products?.length) {
        // 2a. Correspondência exata no nome do produto
        let found = products.find(p => p?.nome && normalizeText(p.nome) === nameNorm)

        // 2b. Correspondência por substring/inclusão
        if (!found) {
            found = products.find(p => {
                if (!p?.nome) return false
                const pNorm = normalizeText(p.nome)
                return pNorm.includes(nameNorm) || nameNorm.includes(pNorm)
            })
        }

        if (found && found.controlar_estoque) {
            return found.quantidade_disponivel ?? 0
        }

        // 2c. Se não achou na linha principal do produto, verificar se algum produto tem a opção nas suas opcoes_personalizacao
        for (const p of products) {
            if (p.opcoes_personalizacao && Array.isArray(p.opcoes_personalizacao)) {
                for (const g of p.opcoes_personalizacao) {
                    if (!g?.opcoes) continue
                    for (const opt of g.opcoes) {
                        const oName = typeof opt === 'string' ? opt : (opt?.nome || opt?.name)
                        if (!oName) continue
                        const oNorm = normalizeText(oName)
                        if (oNorm === nameNorm || oNorm.includes(nameNorm) || nameNorm.includes(oNorm)) {
                            if (typeof opt === 'object' && opt !== null) {
                                if (opt.quantidade !== undefined && opt.quantidade !== null && opt.quantidade !== '') {
                                    return Number(opt.quantidade)
                                }
                                if (opt.quantidade_disponivel !== undefined && opt.quantidade_disponivel !== null) {
                                    return Number(opt.quantidade_disponivel)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return null
}


/**
 * Conta quantas vezes uma opção já está no carrinho (somando quantidades).
 * Percorre personalizacao de cada item do carrinho com normalização flexível.
 *
 * @param {string} optionName - Nome da opção para contar
 * @param {Array} cartItems - Itens atuais do carrinho
 * @returns {number} - Total dessa opção já no carrinho
 */
export function getOptionCartCount(optionName, cartItems) {
    if (!optionName || !cartItems?.length) return 0

    const nameNorm = normalizeText(optionName)
    if (!nameNorm) return 0
    let count = 0

    cartItems.forEach(cartItem => {
        if (!cartItem.personalizacao) return
        Object.values(cartItem.personalizacao).forEach(pVal => {
            const pList = Array.isArray(pVal) ? pVal : [pVal]
            pList.forEach(name => {
                if (typeof name === 'string') {
                    const itemNorm = normalizeText(name)
                    if (itemNorm === nameNorm || itemNorm.includes(nameNorm) || nameNorm.includes(itemNorm)) {
                        count += (cartItem.quantidade || 1)
                    }
                }
            })
        })
    })

    return count
}

/**
 * Valida se uma opção (arroz, acompanhamento) tem estoque suficiente
 * para a quantidade solicitada, considerando o que já está no carrinho.
 *
 * @param {string} optionName - Nome da opção
 * @param {number} requestedQty - Quantidade sendo pedida agora
 * @param {Array} [products] - Catálogo de produtos
 * @param {Array} [cartItems] - Itens no carrinho
 * @param {Object|Array} [productOrOptions] - Produto atual ou opções de personalização
 * @returns {{ valid: boolean, availableQty: number|null, message: string|null }}
 */
export function validateOptionStock(optionName, requestedQty, products = [], cartItems = [], productOrOptions = null) {
    const stock = getOptionStock(optionName, products, productOrOptions)

    // Sem controle de estoque → sempre válido
    if (stock === null) {
        return { valid: true, availableQty: null, message: null }
    }

    const inCart = getOptionCartCount(optionName, cartItems)
    const totalRequested = inCart + requestedQty
    const remaining = Math.max(0, stock - inCart)

    if (totalRequested > stock) {
        return {
            valid: false,
            availableQty: remaining,
            message: `Infelizmente só temos ${remaining} ${remaining === 1 ? 'unidade' : 'unidades'} de ${optionName} disponível no momento.`
        }
    }

    return { valid: true, availableQty: remaining, message: null }
}

/**
 * Valida TODAS as opções selecionadas de uma vez.
 * Retorna o primeiro resultado inválido encontrado, ou valid=true se todas passam.
 *
 * @param {Object} selectedOptions - Mapa { grupoName: valor_ou_array }
 * @param {number} qty - Quantidade do item sendo adicionado
 * @param {Array} [products] - Catálogo de produtos
 * @param {Array} [cartItems] - Itens no carrinho
 * @param {Object|Array} [productOrOptions] - Produto atual ou opções de personalização
 * @returns {{ valid: boolean, availableQty: number|null, productName: string|null, message: string|null }}
 */
export function validateAllOptions(selectedOptions, qty, products = [], cartItems = [], productOrOptions = null) {
    if (!selectedOptions || typeof selectedOptions !== 'object') {
        return { valid: true, availableQty: null, productName: null, message: null }
    }

    for (const [, val] of Object.entries(selectedOptions)) {
        const selectedList = Array.isArray(val) ? val : [val]
        for (const optName of selectedList) {
            if (!optName || typeof optName !== 'string') continue
            const result = validateOptionStock(optName, qty, products, cartItems, productOrOptions)
            if (!result.valid) {
                return { ...result, productName: optName }
            }
        }
    }

    return { valid: true, availableQty: null, productName: null, message: null }
}

