// Testes de regressão: Validação de Espetinho (Completo vs Não-Completo) e Bebidas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('ProductPage.jsx: Variação não-completa de espetinho não bloqueia seleção de arroz @spec:REG-001', () => {
    const filePath = path.resolve('src/pages/customer/ProductPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Valida que disabledGroups é respeitado na validação de rádios e arroz
    assert.ok(
        content.includes('if (disabledGroups.has(group.grupo)) return true'),
        'Deveria ignorar grupos desabilitados (disabledGroups) na validação de radioValid'
    );
    assert.ok(
        content.includes('if (disabledGroups.has(group.grupo)) return false'),
        'Deveria ignorar grupos desabilitados (disabledGroups) na busca de missingRadio'
    );
    assert.ok(
        content.includes('if (arrozGroup && !disabledGroups.has(arrozGroup.grupo))'),
        'Validação de arroz só deve exigir se o grupo de arroz não estiver em disabledGroups'
    );
});

test('ProductPage.jsx: Validação de sabor obrigatório é isolada para Bebidas @spec:REG-002', () => {
    const filePath = path.resolve('src/pages/customer/ProductPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Valida que isBebida é checado e que não usa "tipo" genérico que colide com "Tipo de Arroz"
    assert.ok(
        !content.includes("isSaborOrTipo"),
        'Não deve usar isSaborOrTipo genérico que causava colisão com Tipo de Arroz'
    );
    assert.ok(
        content.includes("isBebida && group.tipo === 'radio' && (group.grupo || '').toLowerCase().includes('sabor')"),
        'Obrigatoriedade de rádio deve ser restrita a sabor de Bebidas'
    );
});

