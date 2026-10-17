import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const customSelectJsxPath = path.resolve('src/components/ui/CustomSelect.jsx')
const customSelectCssPath = path.resolve('src/components/ui/CustomSelect.css')
const sheetJsxPath = path.resolve('src/components/admin/EditOrderDetailsSheet.jsx')

// AC-063 — Componente CustomSelect com trigger, popover e click-outside
test('AC-063: Componente CustomSelect existe e possui suporte a click-outside e dropdown @spec:AC-063', () => {
    assert.equal(fs.existsSync(customSelectJsxPath), true, 'Arquivo CustomSelect.jsx deve existir')
    assert.equal(fs.existsSync(customSelectCssPath), true, 'Arquivo CustomSelect.css deve existir')

    const jsxContent = fs.readFileSync(customSelectJsxPath, 'utf8')
    assert.equal(jsxContent.includes('custom-select-trigger'), true, 'Deve possuir elemento trigger')
    assert.equal(jsxContent.includes('custom-select-popover') || jsxContent.includes('custom-select-dropdown'), true, 'Deve possuir container de dropdown')
    assert.equal(jsxContent.includes('addEventListener') || jsxContent.includes('useEffect'), true, 'Deve ter listener para click-outside')
})

// AC-064 — Seleção de Taxa de Entrega / Bairro usando CustomSelect
test('AC-064: EditOrderDetailsSheet utiliza CustomSelect para seleção de Bairros / Taxas @spec:AC-064', () => {
    const sheetContent = fs.readFileSync(sheetJsxPath, 'utf8')
    assert.equal(sheetContent.includes('CustomSelect'), true, 'Deve importar CustomSelect')
    assert.equal(sheetContent.includes('<CustomSelect'), true, 'Deve renderizar CustomSelect no formulário')
    assert.equal(sheetContent.includes('options={deliveryFeeOptions') || sheetContent.includes('deliveryFees.map'), true, 'Deve passar opções de frete para o CustomSelect')
})

// AC-065 — Seleção de Forma de Pagamento usando CustomSelect
test('AC-065: EditOrderDetailsSheet utiliza CustomSelect para seleção de Forma de Pagamento @spec:AC-065', () => {
    const sheetContent = fs.readFileSync(sheetJsxPath, 'utf8')
    // Não deve haver tag <select nativa para forma de pagamento
    assert.equal(sheetContent.includes('<select'), false, 'Não deve mais usar a tag nativa <select>')
})
