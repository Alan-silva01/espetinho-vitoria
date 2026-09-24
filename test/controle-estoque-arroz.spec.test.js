// Testes de spec da feature controle-estoque-arroz — TDD RED→GREEN
// Valida que a lógica de estoque de acompanhamentos (arroz) funciona corretamente.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import das funções puras de validação
import {
    getOptionStock,
    getOptionCartCount,
    validateOptionStock,
    validateAllOptions
} from '../src/lib/stockValidator.js';

// ---------- fixtures ----------

function makeProduct(nome, qtd, controlar = true) {
    return {
        id: `prod-${nome.toLowerCase().replace(/\s/g, '-')}`,
        nome,
        controlar_estoque: controlar,
        quantidade_disponivel: qtd,
        disponivel: qtd > 0,
    };
}

function makeCartItem(produtoId, quantidade, personalizacao) {
    return {
        produto_id: produtoId,
        quantidade,
        personalizacao,
        preco: 15,
        nome: 'Espetinho Completo',
    };
}

// ---------- catálogo padrão ----------

const CATALOGO = [
    makeProduct('Arroz Baião', 1),
    makeProduct('Arroz Branco', 100, false), // sem controle de estoque
    makeProduct('Farofa', 10),
    makeProduct('Vinagrete', 50, false),
];

// ========== US-001 — Estoque de arroz é validado ao adicionar ao carrinho ==========

// AC-001 — Arroz com estoque suficiente permite adicionar
test('AC-001: Arroz Baião estoque=1, pedir 1, carrinho vazio → válido @spec:AC-001', () => {
    // Dado: Arroz Baião com estoque 1
    const products = [makeProduct('Arroz Baião', 1)];
    const cartItems = [];

    // Quando: cliente tenta adicionar 1 espetinho com Arroz Baião
    const result = validateOptionStock('Arroz Baião', 1, products, cartItems);

    // Então: validação passa
    assert.equal(result.valid, true, 'Deveria permitir pedir 1 quando estoque é 1');
    assert.equal(result.message, null, 'Não deveria ter mensagem de erro');
});

// AC-002 — Arroz com estoque insuficiente bloqueia e mostra mensagem
test('AC-002: Arroz Baião estoque=1, pedir 2, carrinho vazio → bloqueado com mensagem @spec:AC-002', () => {
    // Dado: Arroz Baião com estoque 1
    const products = [makeProduct('Arroz Baião', 1)];
    const cartItems = [];

    // Quando: cliente tenta adicionar 2 espetinhos com Arroz Baião
    const result = validateOptionStock('Arroz Baião', 2, products, cartItems);

    // Então: validação falha com mensagem
    assert.equal(result.valid, false, 'Deveria BLOQUEAR pedir 2 quando estoque é 1');
    assert.equal(result.availableQty, 1, 'Deveria informar que tem 1 disponível');
    assert.ok(
        result.message.includes('1') && result.message.toLowerCase().includes('arroz baião'),
        `Mensagem deveria mencionar quantidade e nome do produto. Recebeu: "${result.message}"`
    );
});

// AC-003 — Estoque considera itens já no carrinho
test('AC-003: Arroz Baião estoque=1, já tem 1 no carrinho, pedir mais 1 → bloqueado @spec:AC-003', () => {
    // Dado: Arroz Baião com estoque 1 e 1 já no carrinho
    const products = [makeProduct('Arroz Baião', 1)];
    const cartItems = [
        makeCartItem('esp-001', 1, { 'Tipo de Arroz': 'Arroz Baião' })
    ];

    // Quando: cliente tenta adicionar mais 1
    const result = validateOptionStock('Arroz Baião', 1, products, cartItems);

    // Então: bloqueado, disponível = 0
    assert.equal(result.valid, false, 'Deveria BLOQUEAR — já tem 1 no carrinho e estoque é 1');
    assert.equal(result.availableQty, 0, 'Deveria informar 0 disponível');
});

// AC-004 — Arroz sem controle de estoque não é bloqueado
test('AC-004: Arroz Branco sem controle de estoque → sempre válido @spec:AC-004', () => {
    // Dado: Arroz Branco sem controle de estoque
    const products = [makeProduct('Arroz Branco', 0, false)];
    const cartItems = [];

    // Quando: cliente tenta adicionar 10 espetinhos com Arroz Branco
    const result = validateOptionStock('Arroz Branco', 10, products, cartItems);

    // Então: validação passa (sem restrição)
    assert.equal(result.valid, true, 'Sem controle de estoque → sempre válido');
    assert.equal(result.availableQty, null, 'availableQty deveria ser null (sem controle)');
});

// AC-005 — Arroz esgotado bloqueia completamente
test('AC-005: Arroz Baião estoque=0 (esgotado), pedir 1 → bloqueado @spec:AC-005', () => {
    // Dado: Arroz Baião esgotado
    const products = [makeProduct('Arroz Baião', 0)];
    const cartItems = [];

    // Quando: cliente tenta adicionar 1
    const result = validateOptionStock('Arroz Baião', 1, products, cartItems);

    // Então: bloqueado
    assert.equal(result.valid, false, 'Estoque 0 deveria BLOQUEAR');
    assert.equal(result.availableQty, 0, 'Disponível deveria ser 0');
});

// AC-006 — Estoque alto permite múltiplos pedidos
test('AC-006: Arroz Baião estoque=5, pedir 3, carrinho vazio → válido @spec:AC-006', () => {
    // Dado: Arroz Baião com estoque 5
    const products = [makeProduct('Arroz Baião', 5)];
    const cartItems = [];

    // Quando: cliente tenta adicionar 3
    const result = validateOptionStock('Arroz Baião', 3, products, cartItems);

    // Então: válido
    assert.equal(result.valid, true, 'Estoque 5 deveria permitir pedir 3');
});

// AC-007 — Carrinho parcial + novo pedido excede estoque
test('AC-007: Arroz Baião estoque=5, 3 no carrinho, pedir mais 3 → bloqueado, disponível=2 @spec:AC-007', () => {
    // Dado: Arroz Baião com estoque 5 e 3 já no carrinho
    const products = [makeProduct('Arroz Baião', 5)];
    const cartItems = [
        makeCartItem('esp-001', 3, { 'Tipo de Arroz': 'Arroz Baião' })
    ];

    // Quando: cliente tenta adicionar mais 3
    const result = validateOptionStock('Arroz Baião', 3, products, cartItems);

    // Então: bloqueado, disponível = 2
    assert.equal(result.valid, false, 'Deveria BLOQUEAR — 3+3=6 > 5');
    assert.equal(result.availableQty, 2, 'Deveria informar 2 disponíveis (5-3)');
});

// AC-008 — Validação em lote para todas as opções selecionadas
test('AC-008: validateAllOptions — um arroz OK, outro esgotado → falha no primeiro inválido @spec:AC-008', () => {
    // Dado: Arroz Baião estoque=1, Farofa estoque=10
    const products = [
        makeProduct('Arroz Baião', 1),
        makeProduct('Farofa', 10),
    ];
    const cartItems = [
        makeCartItem('esp-001', 1, { 'Tipo de Arroz': 'Arroz Baião' })
    ];

    // Quando: validação em lote com Arroz Baião (já esgotou) + Farofa (OK)
    const selectedOptions = {
        'Tipo de Arroz': 'Arroz Baião',
        'Acompanhamentos': ['Farofa']
    };
    const result = validateAllOptions(selectedOptions, 1, products, cartItems);

    // Então: falha no Arroz Baião
    assert.equal(result.valid, false, 'Deveria falhar — Arroz Baião já está no carrinho');
    assert.equal(result.productName, 'Arroz Baião', 'Deveria identificar qual produto falhou');
});

// ---------- Testes auxiliares — getOptionStock ----------

test('getOptionStock: retorna estoque quando controlar_estoque=true @spec:AUX-001', () => {
    const products = [makeProduct('Arroz Baião', 3)];
    const stock = getOptionStock('Arroz Baião', products);
    assert.equal(stock, 3);
});

test('getOptionStock: retorna null quando controlar_estoque=false @spec:AUX-002', () => {
    const products = [makeProduct('Arroz Branco', 100, false)];
    const stock = getOptionStock('Arroz Branco', products);
    assert.equal(stock, null);
});

test('getOptionStock: match é case-insensitive @spec:AUX-003', () => {
    const products = [makeProduct('Arroz Baião', 2)];
    assert.equal(getOptionStock('arroz baião', products), 2);
    assert.equal(getOptionStock('ARROZ BAIÃO', products), 2);
});

test('getOptionStock: retorna null para produto inexistente @spec:AUX-004', () => {
    const products = [makeProduct('Arroz Baião', 2)];
    assert.equal(getOptionStock('Arroz Integral', products), null);
});

// ---------- Testes auxiliares — getOptionCartCount ----------

test('getOptionCartCount: conta corretamente arroz no carrinho @spec:AUX-005', () => {
    const cartItems = [
        makeCartItem('esp-001', 2, { 'Tipo de Arroz': 'Arroz Baião' }),
        makeCartItem('esp-002', 1, { 'Tipo de Arroz': 'Arroz Branco' }),
        makeCartItem('esp-003', 1, { 'Tipo de Arroz': 'Arroz Baião' }),
    ];
    // 2 + 1 = 3 Arroz Baião
    assert.equal(getOptionCartCount('Arroz Baião', cartItems), 3);
});

test('getOptionCartCount: conta arroz em arrays de acompanhamentos @spec:AUX-006', () => {
    const cartItems = [
        makeCartItem('esp-001', 1, {
            'Acompanhamentos': ['Farofa', 'Vinagrete'],
            'Tipo de Arroz': 'Arroz Baião'
        }),
    ];
    assert.equal(getOptionCartCount('Arroz Baião', cartItems), 1);
    assert.equal(getOptionCartCount('Farofa', cartItems), 1);
});

test('getOptionCartCount: retorna 0 para carrinho vazio @spec:AUX-007', () => {
    assert.equal(getOptionCartCount('Arroz Baião', []), 0);
    assert.equal(getOptionCartCount('Arroz Baião', null), 0);
});

test('getOptionStock: match insensível a acentuação (baiao vs baião) @spec:AUX-008', () => {
    const products = [makeProduct('Arroz Baião', 1)];
    assert.equal(getOptionStock('Arroz Baiao', products), 1);
    assert.equal(getOptionStock('arroz baiao', products), 1);
});

test('getOptionStock: match por substring (ex: Arroz Baião de Dois vs Arroz Baião) @spec:AUX-009', () => {
    const products = [makeProduct('Arroz Baião de Dois', 2)];
    assert.equal(getOptionStock('Arroz Baião', products), 2);
});

// ========== AC-009 — Resolução de estoque a partir de opcoes_personalizacao ==========

test('AC-009: getOptionStock extrai estoque direto de opcoes_personalizacao @spec:AC-009', () => {
    // Objeto de produto no formato real do Supabase:
    const product = {
        id: 'prod-espetinho',
        nome: 'Espetinho de Frango',
        opcoes_personalizacao: [
            {
                grupo: 'Tipo de Arroz',
                tipo: 'radio',
                opcoes: [
                    { nome: 'Baião de Dois', quantidade: 21, disponivel: true },
                    { nome: 'Arroz com Cenoura', quantidade: 1, disponivel: false },
                    { nome: 'Arroz com Cuxá', quantidade: 0, disponivel: false },
                    { nome: 'Arroz sem limite' } // sem controle/sem quantidade
                ]
            }
        ]
    };

    // 1. Opção com estoque = 1
    assert.equal(getOptionStock('Arroz com Cenoura', [], product), 1, 'Deveria retornar 1 para Arroz com Cenoura');

    // 2. Opção com estoque = 21
    assert.equal(getOptionStock('Baião de Dois', [], product), 21, 'Deveria retornar 21 para Baião de Dois');

    // 3. Opção com estoque = 0 (esgotado)
    assert.equal(getOptionStock('Arroz com Cuxá', [], product), 0, 'Deveria retornar 0 para Arroz com Cuxá');

    // 4. Opção sem quantidade definida
    assert.equal(getOptionStock('Arroz sem limite', [], product), null, 'Deveria retornar null quando não tem quantidade controlada');
});

test('AC-009: validateOptionStock com product.opcoes_personalizacao bloqueia quando pedido > estoque @spec:AC-009', () => {
    const product = {
        id: 'prod-espetinho',
        nome: 'Espetinho de Frango',
        opcoes_personalizacao: [
            {
                grupo: 'Tipo de Arroz',
                tipo: 'radio',
                opcoes: [
                    { nome: 'Arroz com Cenoura', quantidade: 1, disponivel: false }
                ]
            }
        ]
    };

    // Pedir 1 espetinho com Arroz com Cenoura (estoque = 1) -> Válido
    const res1 = validateOptionStock('Arroz com Cenoura', 1, [], [], product);
    assert.equal(res1.valid, true, 'Pedir 1 com estoque 1 deveria ser válido');

    // Pedir 2 espetinhos com Arroz com Cenoura (estoque = 1) -> Bloqueado
    const res2 = validateOptionStock('Arroz com Cenoura', 2, [], [], product);
    assert.equal(res2.valid, false, 'Pedir 2 com estoque 1 deveria ser BLOQUEADO');
    assert.equal(res2.availableQty, 1, 'Deveria indicar 1 disponível');
    assert.ok(res2.message.includes('1'), 'Mensagem deve indicar que só tem 1 disponível');
});
// ========== AC-010 — Bloqueio no botão '+' de quantidade quando a opção selecionada não suporta ==========

test('AC-010: validateAllOptions com nextQty excede estoque da opção selecionada @spec:AC-010', () => {
    const product = {
        id: 'prod-espetinho',
        nome: 'Espetinho de Frango',
        opcoes_personalizacao: [
            {
                grupo: 'Tipo de Arroz',
                tipo: 'radio',
                opcoes: [
                    { nome: 'Arroz com Cenoura', quantidade: 1, disponivel: false }
                ]
            }
        ]
    };

    const selectedOptions = { 'Tipo de Arroz': 'Arroz com Cenoura' };

    // Usuário está em qty=1 e tenta clicar no '+' para nextQty=2
    const validationNext = validateAllOptions(selectedOptions, 2, [], [], product);

    assert.equal(validationNext.valid, false, 'Deveria bloquear o incremento para 2');
    assert.equal(validationNext.productName, 'Arroz com Cenoura');
    assert.equal(validationNext.availableQty, 1);
});

// ========== AC-011 — Bloqueio ao selecionar opção quando qty atual excede o estoque da opção ==========

test('AC-011: validateOptionStock bloqueia seleção se qty atual > estoque da opção @spec:AC-011', () => {
    const product = {
        id: 'prod-espetinho',
        nome: 'Espetinho de Frango',
        opcoes_personalizacao: [
            {
                grupo: 'Tipo de Arroz',
                tipo: 'radio',
                opcoes: [
                    { nome: 'Arroz com Cenoura', quantidade: 1, disponivel: false }
                ]
            }
        ]
    };

    // Usuário já colocou qty = 4 no rodapé e tenta selecionar 'Arroz com Cenoura' (estoque = 1)
    const currentQty = 4;
    const result = validateOptionStock('Arroz com Cenoura', currentQty, [], [], product);

    assert.equal(result.valid, false, 'Deveria bloquear a seleção pois qty=4 excede estoque=1');
    assert.equal(result.availableQty, 1, 'Deveria informar que só há 1 unidade');
    assert.ok(result.message.includes('1'), 'Mensagem de alerta deve exibir 1 unidade disponível');
});
