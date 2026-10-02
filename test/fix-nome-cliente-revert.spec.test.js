// Testes de spec da feature fix-nome-cliente-revert — gerados por onp-spec scaffold
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function readFile(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

// AC-040: handleSave no admin sincroniza todos os campos de nome no JSONB

test('AC-040: handleSave grava dados.nome_recebedor ao editar cliente @spec:AC-040', () => {
  const source = readFile('src/pages/admin/CustomersPage.jsx');
  assert.ok(
    source.includes('nome_recebedor: formData.nome'),
    'handleSave deve incluir "nome_recebedor: formData.nome" em updatedDados'
  );
});

test('AC-040b: handleSave grava endereco.nome_recebedor ao editar cliente @spec:AC-040', () => {
  const source = readFile('src/pages/admin/CustomersPage.jsx');
  const enderecoBlock = source.match(/endereco:\s*\{[\s\S]*?nome_recebedor:\s*formData\.nome[\s\S]*?\}/);
  assert.ok(
    enderecoBlock !== null,
    'handleSave deve incluir "nome_recebedor: formData.nome" dentro do bloco endereco'
  );
});

// AC-041: CheckoutPage usa customer.nome (banco) e não nome_recebedor do localStorage

test('AC-041: CheckoutPage usa customer.nome para pedidos de entrega @spec:AC-041', () => {
  const source = readFile('src/pages/customer/CheckoutPage.jsx');
  assert.ok(
    source.includes('customer?.nome || addressData.nome_recebedor'),
    'Para entrega, o nome deve vir de customer.nome (banco) com fallback para addressData.nome_recebedor'
  );
});

test('AC-041b: CheckoutPage não passa nome no extraInfo do updateLastOrder @spec:AC-041', () => {
  const source = readFile('src/pages/customer/CheckoutPage.jsx');
  // Deve passar {} (sem nome) no extraInfo
  assert.ok(
    source.includes('{ nome: orderData.nome_cliente }') === false,
    'CheckoutPage não deve mais passar { nome: orderData.nome_cliente } para updateLastOrder — evita sobrescrita'
  );
});

// AC-043: updateLastOrder não sobrescreve nome no banco desnecessariamente

test('AC-043: updateLastOrder remove nome do updateObj antes de updateCustomerData @spec:AC-043', () => {
  const source = readFile('src/context/CustomerContext.jsx');
  assert.ok(
    source.includes('delete updateObj.nome'),
    'updateLastOrder deve fazer "delete updateObj.nome" antes de chamar updateCustomerData'
  );
});
