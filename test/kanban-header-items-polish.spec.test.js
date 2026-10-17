import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ordersPageJsxPath = path.resolve('src/pages/admin/OrdersPage.jsx')
const ordersPageCssPath = path.resolve('src/pages/admin/OrdersPage.css')
const orderDetailModalJsxPath = path.resolve('src/components/admin/OrderDetailModal.jsx')
const kanbanCardJsxPath = path.resolve('src/components/admin/KanbanOrderCard.jsx')

// AC-058 — Botão de som compacto com ícone Volume2 e tooltip no header do Kanban
test('AC-058: Botão de som no header utiliza Volume2 sem texto solto e com title @spec:AC-058', () => {
    const content = fs.readFileSync(ordersPageJsxPath, 'utf8')
    assert.equal(content.includes('Volume2'), true, 'OrdersPage deve importar e usar o ícone Volume2')
    assert.equal(
        content.includes('Som ativo (Clique para desativar)') ||
        content.includes('title="Testar Som de Notificação"') ||
        content.includes('title="Testar som"'),
        true,
        'Botão de som deve ter atributo title/tooltip dinâmico'
    )
    // Não deve ter o texto "Ativar Som" solto
    assert.equal(content.includes('>Ativar Som<') || content.includes('Ativar Som\n'), false, 'Não deve exibir texto solto Ativar Som')
})

// AC-059 — Ajuste e harmonização visual do filtro e busca no header
test('AC-059: Botão de som e gatilho de data possuem estilo padronizado no CSS @spec:AC-059', () => {
    const cssContent = fs.readFileSync(ordersPageCssPath, 'utf8')
    assert.equal(cssContent.includes('.btn-sound-test') || cssContent.includes('.btn-sound-kanban'), true, 'Deve ter classe para o botão de som')
    assert.equal(cssContent.includes('.orders-date-filter-trigger'), true, 'Deve ter estilização de orders-date-filter-trigger')
})

// AC-060 — Nome dos itens de pedidos em negrito no modal de detalhes (recibo)
test('AC-060: Nome do item no modal de detalhes possui destaque em negrito @spec:AC-060', () => {
    const jsxContent = fs.readFileSync(orderDetailModalJsxPath, 'utf8')
    const cssContent = fs.readFileSync(ordersPageCssPath, 'utf8')

    // Deve estar no JSX envolvido por strong ou com classe específica com font-weight
    const hasBoldInJsx = jsxContent.includes('<strong>{getItemDisplayName(item)}</strong>') ||
        jsxContent.includes('receipt-item-name-bold') ||
        jsxContent.includes('receipt-item-title')
    assert.equal(hasBoldInJsx, true, 'O nome do item deve estar presente e com classe de título')

    // No CSS, o nome do item no recibo deve ter font-weight bold/700
    assert.equal(cssContent.includes('.receipt-item-title') && (cssContent.includes('font-weight: 700') || cssContent.includes('font-weight: 800') || cssContent.includes('font-weight: 600')), true, 'receipt-item-title deve ter peso em negrito')
})

// AC-061 — Nome dos itens de pedidos em negrito no card do Kanban
test('AC-061: Nome dos itens no card do Kanban possui estilo com font-weight destacado @spec:AC-061', () => {
    const cardJsx = fs.readFileSync(kanbanCardJsxPath, 'utf8')
    const cssContent = fs.readFileSync(ordersPageCssPath, 'utf8')

    assert.equal(cardJsx.includes('card-ref-item-name'), true, 'Kanban card deve usar classe card-ref-item-name')
    assert.equal(cssContent.includes('.card-ref-item-name'), true, 'CSS deve conter classe card-ref-item-name')
    assert.equal(cssContent.includes('font-weight: 700') || cssContent.includes('font-weight: 800'), true, 'card-ref-item-name deve ter font-weight em negrito')
})

// AC-062 — Indicador visual de som ativo (verde) e inativo (vermelho) com toggle
test('AC-062: Botão de som possui estados sound-active e sound-inactive e alterna com toggle @spec:AC-062', () => {
    const ordersJsx = fs.readFileSync(ordersPageJsxPath, 'utf8')
    const cssContent = fs.readFileSync(ordersPageCssPath, 'utf8')
    const hookContent = fs.readFileSync(path.resolve('src/hooks/useOrderNotificationSound.js'), 'utf8')

    assert.equal(ordersJsx.includes('sound-active') && ordersJsx.includes('sound-inactive'), true, 'OrdersPage deve alternar classes sound-active e sound-inactive')
    assert.equal(ordersJsx.includes('toggleSound'), true, 'OrdersPage deve acionar toggleSound ao clicar')
    assert.equal(cssContent.includes('.btn-sound-test.sound-active'), true, 'CSS deve conter estilo para .sound-active verde')
    assert.equal(cssContent.includes('.btn-sound-test.sound-inactive'), true, 'CSS deve conter estilo para .sound-inactive vermelho')
    assert.equal(hookContent.includes('toggleSound'), true, 'Hook de som deve exportar toggleSound')
    assert.equal(hookContent.includes('isSoundActive'), true, 'Hook de som deve gerenciar isSoundActive')
})

