/**
 * Utilitários para exibição e filtragem de pedidos do Dashboard
 */

/**
 * Remove qualquer caractere '#' inicial do número do pedido e garante string legível
 * @param {string|number} orderNumber
 * @returns {string}
 */
export function formatOrderNumberWithoutHash(orderNumber) {
    if (orderNumber === null || orderNumber === undefined) return '';
    const cleanStr = String(orderNumber).trim();
    return cleanStr.replace(/^#+/, '');
}

/**
 * Filtra pedidos que pertencem estritamente ao dia atual (fuso horário local/São Paulo)
 * e ordena de forma decrescente por criado_em
 * @param {Array} orders
 * @param {Date|string} [referenceDate]
 * @returns {Array}
 */
export function filterTodayOrders(orders, referenceDate = new Date()) {
    if (!Array.isArray(orders)) return [];
    
    // Obter YYYY-MM-DD da data de referência em São Paulo
    const refDateObj = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const spRefDateStr = refDateObj.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    return orders.filter(order => {
        if (!order || !order.criado_em) return false;
        const orderDateObj = new Date(order.criado_em);
        const orderSpDateStr = orderDateObj.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        return orderSpDateStr === spRefDateStr;
    }).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
}
