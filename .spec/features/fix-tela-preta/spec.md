# Spec: Fix tela preta

> feature: fix-tela-preta
> status: rascunho

## Contexto

Alguns clientes acessam o link do app (PWA) em celulares com navegadores ou
WebViews mais antigos (Safari < 15, Instagram/WhatsApp in-app browser, Android
WebView desatualizado) e veem tela preta ou branca — nenhum conteúdo carrega.
A causa raiz é um `top-level await` no módulo principal (`App.jsx`) que gera
`SyntaxError` antes do React montar, e a ausência de fallback visual no HTML.

## Histórias

### US-001 — Cliente vê o app em qualquer celular

Como cliente, quero que o app carregue corretamente em qualquer celular
moderno (últimos 5 anos), para que eu consiga fazer meu pedido
independentemente do navegador ou da forma como abri o link.

#### AC-001 — App.jsx não usa top-level await

- **Dado** o código-fonte de `src/App.jsx`
- **Quando** o módulo é analisado
- **Então** não existe nenhum `await` no nível raiz do módulo (fora de funções)

#### AC-002 — PWA continua sendo registrado

- **Dado** o app carregado num navegador com suporte a Service Worker
- **Quando** a página termina de carregar
- **Então** o registro do Service Worker é iniciado (via IIFE async)

#### AC-003 — HTML mostra fallback visual se JS falhar

- **Dado** o `index.html` de produção
- **Quando** o conteúdo do `<div id="root">` é inspecionado antes do React montar
- **Então** existe um fallback visual com logo e texto "Carregando..."

### US-002 — Código mantém boas práticas

Como desenvolvedor, quero que os componentes não usem APIs inexistentes no
projeto, para evitar comportamento inesperado.

#### AC-004 — OptimizedImage não usa style jsx

- **Dado** o componente `src/components/ui/OptimizedImage.jsx`
- **Quando** o código-fonte é analisado
- **Então** não contém tag `<style jsx>` (styled-jsx não está instalado) e
  importa seus estilos via arquivo CSS separado

## Fora de escopo

- Suporte a navegadores anteriores a 2018 (IE11, Android 4.x)
- Adição do plugin `@vitejs/plugin-legacy` (impacto no bundle size)
- Alterações visuais ou de funcionalidade do app

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | A tela preta é causada por erro de sintaxe (TLA) e não por falha de rede ou API | confirmada | Verificado no bundle de produção: `await` literal no nível raiz do módulo |
| ASM-002 | Envolver o TLA em IIFE async não muda o comportamento do PWA | confirmada | Build e registro SW funcionam identicamente |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | Há clientes específicos reportando o problema para validar depois do fix? | aberta | — |
