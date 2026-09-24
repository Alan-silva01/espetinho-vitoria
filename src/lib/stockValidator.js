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
 * Busca o estoque disponível de uma opção (ex: "Arroz Baião") no catálogo de produtos.
 * Retorna null se o produto não existe ou não tem controle de estoque ativo.
 * Suporta correspondência exata ou normalizada/insensível a acentuação e substring.
 *
 * @param {string} optionName - Nome da opção (ex: "Arroz Baião")
 * @param {Array} products - Lista de produtos do catálogo
 * @returns {number|null} - Quantidade disponível ou null se sem controle
 */
export function getOptionStock(optionName, products) {
    if (!optionName || !products?.length) return null
    const nameNorm = normalizeText(optionName)
    if (!nameNorm) return null

    // 1. Procura correspondência exata normalizada (ex: "arroz baiao" === "arroz baiao")
    let found = products.find(p => p?.nome && normalizeText(p.nome) === nameNorm)

    // 2. Se não encontrou, procura por substring/inclusão (ex: "Arroz Baião de Dois" contém "Arroz Baião")
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
 * @param {Array} products - Catálogo de produtos
 * @param {Array} cartItems - Itens no carrinho
 * @returns {{ valid: boolean, availableQty: number|null, message: string|null }}
 */
export function validateOptionStock(optionName, requestedQty, products, cartItems) {
    const stock = getOptionStock(optionName, products)

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
 * @param {Array} products - Catálogo de produtos
 * @param {Array} cartItems - Itens no carrinho
 * @returns {{ valid: boolean, availableQty: number|null, productName: string|null, message: string|null }}
 */
export function validateAllOptions(selectedOptions, qty, products, cartItems) {
    if (!selectedOptions || typeof selectedOptions !== 'object') {
        return { valid: true, availableQty: null, productName: null, message: null }
    }

    for (const [, val] of Object.entries(selectedOptions)) {
        const selectedList = Array.isArray(val) ? val : [val]
        for (const optName of selectedList) {
            if (!optName || typeof optName !== 'string') continue
            const result = validateOptionStock(optName, qty, products, cartItems)
            if (!result.valid) {
                return { ...result, productName: optName }
            }
        }
    }

    return { valid: true, availableQty: null, productName: null, message: null }
}
