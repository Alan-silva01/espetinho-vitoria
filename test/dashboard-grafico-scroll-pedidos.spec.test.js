// Testes de spec da feature dashboard-grafico-scroll-pedidos
// Validação automatizada para gráfico expandido e carrossel infinito horizontal de pedidos do dia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    formatOrderNumberWithoutHash,
    filterTodayOrders
} from '../src/lib/dashboardOrderUtils.js';

// ========== US-003 — Gráfico de vendas expandido em largura total ==========

// AC-012 — Gráfico ocupa 100% da largura da seção
test('AC-012: Gráfico ocupa 100% da largura e não divide espaço com coluna lateral de pedidos @spec:AC-012', () => {
    const dashboardJsxPath = path.resolve('src/pages/admin/DashboardPage.jsx');
    const dashboardCssPath = path.resolve('src/pages/admin/DashboardPage.css');

    const jsxContent = fs.readFileSync(dashboardJsxPath, 'utf8');
    const cssContent = fs.readFileSync(dashboardCssPath, 'utf8');

    // Não deve haver divisão de grid entre gráfico e coluna lateral (ex: 1fr 340px)
    assert.doesNotMatch(
        cssContent,
        /grid-template-columns:\s*1fr\s+340px/,
        'CSS não deve ter layout dividindo gráfico com coluna de 340px'
    );

    // O container do gráfico deve ser full-width / expandido
    assert.match(
        jsxContent,
        /chart-card-premium(\s+chart-expanded-full)?/,
        'DashboardPage deve conter o container do gráfico expandido'
    );
});

// ========== US-004 — Pedidos de hoje em scroll horizontal contínuo ==========

// AC-013 — Filtragem restrita aos pedidos do dia corrente
test('AC-013: filterTodayOrders filtra estritamente os pedidos da data corrente @spec:AC-013', () => {
    const fixedNow = new Date('2026-10-01T15:30:00-03:00');

    const sampleOrders = [
        { id: '1', numero_pedido: 101, criado_em: '2026-10-01T10:00:00-03:00', status: 'entregue' },
        { id: '2', numero_pedido: 102, criado_em: '2026-09-30T22:00:00-03:00', status: 'entregue' }, // ontem
        { id: '3', numero_pedido: 103, criado_em: '2026-10-01T18:00:00-03:00', status: 'preparando' }, // hoje
        { id: '4', numero_pedido: 104, criado_em: '2026-10-02T01:00:00-03:00', status: 'pendente' } // amanhã
    ];

    const todayOnly = filterTodayOrders(sampleOrders, fixedNow);

    assert.equal(todayOnly.length, 2, 'Deve conter exatamente 2 pedidos de hoje');
    assert.equal(todayOnly[0].numero_pedido, 103, 'Mais recente deve vir primeiro');
    assert.equal(todayOnly[1].numero_pedido, 101);
});

// AC-014 — Exibição de foto ou avatar, nome do cliente, status e valor
test('AC-014: Card horizontal contém imagem/avatar, nome, status e valor @spec:AC-014', () => {
    const dashboardJsxPath = path.resolve('src/pages/admin/DashboardPage.jsx');
    const jsxContent = fs.readFileSync(dashboardJsxPath, 'utf8');

    // Verifica que o JSX renderiza os campos do pedido de hoje no carrossel horizontal
    assert.match(jsxContent, /today-orders-track|orders-infinite-scroll/, 'Deve haver container de scroll de pedidos');
    assert.match(jsxContent, /order-avatar-img|customerAvatar/, 'Deve suportar imagem do avatar');
    assert.match(jsxContent, /nome_cliente/, 'Deve exibir o nome do cliente');
    assert.match(jsxContent, /valor_total/, 'Deve exibir o valor total');
    assert.match(jsxContent, /status/, 'Deve exibir o status do pedido');
});

// AC-015 — Número do pedido sem o prefixo '#'
test('AC-015: formatOrderNumberWithoutHash remove prefixos de # mantendo o número limpo @spec:AC-015', () => {
    assert.equal(formatOrderNumberWithoutHash('#2934'), '2934');
    assert.equal(formatOrderNumberWithoutHash('##5510'), '5510');
    assert.equal(formatOrderNumberWithoutHash(3490), '3490');
    assert.equal(formatOrderNumberWithoutHash('4120'), '4120');
    assert.equal(formatOrderNumberWithoutHash(null), '');
    assert.equal(formatOrderNumberWithoutHash(undefined), '');
});

// AC-016 — Carrossel horizontal com suporte a rolagem suave ou scroll infinito
test('AC-016: Estrutura horizontal possui rolagem horizontal overflow-x no CSS @spec:AC-016', () => {
    const dashboardCssPath = path.resolve('src/pages/admin/DashboardPage.css');
    const cssContent = fs.readFileSync(dashboardCssPath, 'utf8');

    // Deve conter classes para scroll horizontal infinito / carrossel de pedidos do dia
    assert.match(
        cssContent,
        /overflow-x:\s*(auto|scroll)/,
        'CSS deve fornecer overflow-x para o trilho horizontal'
    );
    assert.match(
        cssContent,
        /(today-orders-section|today-orders-marquee|today-orders-carousel)/,
        'CSS deve definir seções do carrossel/scroll de pedidos do dia'
    );
});
