// Testes de spec da feature fix-tela-preta — gerados por onp-spec scaffold
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// ---------- helpers ----------

function readFile(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

/**
 * Detecta top-level await num módulo ESM.
 * Faz parsing simples: remove strings/template literals/comentários,
 * depois percorre o código restante procurando `await` que NÃO esteja
 * dentro de uma função async (tracked por depth de chaves).
 */
function hasTopLevelAwait(source) {
  // Remove string literals, template literals and comments
  const cleaned = source
    .replace(/\/\/[^\n]*/g, '')                   // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')              // block comments
    .replace(/`(?:[^`\\]|\\.)*`/g, '""')           // template literals
    .replace(/'(?:[^'\\]|\\.)*'/g, '""')           // single-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');           // double-quoted strings

  // Track brace depth: when we enter an arrow/function body, depth > 0
  let depth = 0;
  const asyncStack = [];

  // Tokenize simply by splitting on word boundaries
  const tokens = cleaned.match(/\b\w+\b|[{}()=>]/g) || [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === 'async' && (tokens[i + 1] === 'function' || tokens[i + 1] === '(')) {
      asyncStack.push(depth);
    }

    // Also catch: ;(async () => {
    if (token === 'async' && tokens[i + 1] === '(' && i > 0) {
      asyncStack.push(depth);
    }

    if (token === '{') {
      depth++;
    }

    if (token === '}') {
      depth--;
      // If we're exiting an async function body
      if (asyncStack.length > 0 && depth === asyncStack[asyncStack.length - 1]) {
        asyncStack.pop();
      }
    }

    if (token === 'await') {
      const insideAsync = asyncStack.length > 0 && depth > asyncStack[asyncStack.length - 1];
      if (!insideAsync) {
        return true; // Found top-level await
      }
    }
  }

  return false;
}

// ---------- tests ----------

// US-001 — Cliente vê o app em qualquer celular
test('AC-001: App.jsx não usa top-level await @spec:AC-001', () => {
  // Dado: o código-fonte de src/App.jsx
  const source = readFile('src/App.jsx');

  // Quando: o módulo é analisado
  const hasTLA = hasTopLevelAwait(source);

  // Então: não existe nenhum await no nível raiz do módulo
  assert.equal(hasTLA, false,
    'App.jsx contém top-level await — isso causa tela preta em navegadores legados');
});

// US-001 — Cliente vê o app em qualquer celular
test('AC-002: PWA continua sendo registrado @spec:AC-002', () => {
  // Dado: o código-fonte de src/App.jsx
  const source = readFile('src/App.jsx');

  // Quando: verificamos se o registro do PWA existe como IIFE async
  const hasAsyncIIFE = /;\s*\(\s*async\s*\(\s*\)\s*=>\s*\{/.test(source);
  const hasRegisterSW = source.includes("import('virtual:pwa-register')");
  const hasRegisterCall = source.includes('registerSW(');

  // Então: o registro via IIFE async está presente
  assert.ok(hasAsyncIIFE,
    'Deve ter uma IIFE async para registrar o SW sem top-level await');
  assert.ok(hasRegisterSW,
    'Deve importar virtual:pwa-register dinamicamente');
  assert.ok(hasRegisterCall,
    'Deve chamar registerSW() dentro da IIFE');
});

// US-001 — Cliente vê o app em qualquer celular
test('AC-003: HTML mostra fallback visual se JS falhar @spec:AC-003', () => {
  // Dado: o index.html
  const html = readFile('index.html');

  // Quando: o conteúdo do <div id="root"> é inspecionado
  const rootMatch = html.match(/<div\s+id="root"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);

  // Então: existe conteúdo visual de fallback
  assert.ok(rootMatch, 'O div#root deve ter conteúdo interno (fallback)');

  const rootContent = rootMatch[1];
  assert.ok(rootContent.includes('logo.png'),
    'Fallback deve mostrar o logo');
  assert.ok(rootContent.includes('Carregando'),
    'Fallback deve mostrar texto "Carregando..."');
});

// US-002 — Código mantém boas práticas
test('AC-004: OptimizedImage não usa style jsx @spec:AC-004', () => {
  // Dado: o componente src/components/ui/OptimizedImage.jsx
  const source = readFile('src/components/ui/OptimizedImage.jsx');

  // Quando: o código-fonte é analisado
  const hasStyleJsx = source.includes('<style jsx>') || source.includes('<style jsx>');
  const hasCSSimport = source.includes("import './OptimizedImage.css'");

  // Então: não contém <style jsx> e importa CSS externo
  assert.equal(hasStyleJsx, false,
    'OptimizedImage não deve usar <style jsx> — styled-jsx não está instalado');
  assert.ok(hasCSSimport,
    'OptimizedImage deve importar estilos via OptimizedImage.css');
});
