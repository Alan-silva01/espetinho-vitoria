import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { formatPhone } from '../src/lib/utils.js'

const jsxPath = path.resolve('src/components/admin/CreateOrderModal.jsx')
const cssPath = path.resolve('src/components/admin/CreateOrderModal.css')
const layoutPath = path.resolve('src/layouts/CustomerLayout.jsx')

// AC-049 — Cabeçalho do modal segue o tema de recibo com barra escura #232220 e sem emojis
test('AC-049: Cabeçalho possui barra escura #232220 e título institucional sem emojis @spec:AC-049', () => {
    const jsxContent = fs.readFileSync(jsxPath, 'utf8')
    const cssContent = fs.readFileSync(cssPath, 'utf8')

    assert.equal(jsxContent.includes('⚡'), false, 'Não deve conter emoji ⚡ no modal')
    assert.equal(jsxContent.includes('NOVO PEDIDO') || jsxContent.includes('Novo Pedido'), true)
    assert.equal(cssContent.includes('#232220'), true, 'Deve conter cor institucional #232220')
})

// AC-050 — Campo de busca com ícone integrado e foco no padrão #232220
test('AC-050: Campo de busca de clientes integrado com foco na cor institucional @spec:AC-050', () => {
    const jsxContent = fs.readFileSync(jsxPath, 'utf8')
    const cssContent = fs.readFileSync(cssPath, 'utf8')

    assert.equal(jsxContent.includes('search-input-wrapper'), true)
    assert.equal(cssContent.includes('.search-input-wrapper'), true)
})

// AC-051 — Botão 'Iniciar Pedido' na cor verde
test('AC-051: Botão Iniciar Pedido utiliza estilo verde @spec:AC-051', () => {
    const jsxContent = fs.readFileSync(jsxPath, 'utf8')
    const cssContent = fs.readFileSync(cssPath, 'utf8')

    assert.equal(jsxContent.includes('Iniciar Pedido'), true)
    assert.equal(cssContent.includes('#16A34A') || cssContent.includes('#16a34a'), true, 'Botão deve ter cor verde')
})

// AC-052 — Foto do cliente renderizada no avatar com fallback de inicial
test('AC-052: Avatar do cliente suporta imagem de foto @spec:AC-052', () => {
    const jsxContent = fs.readFileSync(jsxPath, 'utf8')

    assert.equal(jsxContent.includes('cust-avatar-img'), true, 'Deve renderizar tag de imagem de avatar')
})

// AC-053 — Telefone do cliente limpo e formatado como em Clientes
test('AC-053: Telefone com @s.whatsapp.net e DDI 55 é formatado corretamente @spec:AC-053', () => {
    const raw = '559991372552@s.whatsapp.net'
    const formatted = formatPhone(raw)
    assert.equal(formatted, '(99) 99137-2552', 'Telefone deve ser formatado sem sufixo e com máscara')
})

// AC-054 — Banner flutuante no app do cliente para retornar ao Painel Admin
test('AC-054: Layout do cliente renderiza botão de retorno ao admin quando aberto a partir do admin @spec:AC-054', () => {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8')

    assert.equal(layoutContent.includes('espetinho_opened_from_admin'), true)
    assert.equal(layoutContent.includes('Voltar ao Painel'), true, 'Deve possuir botão Voltar ao Painel')
})
