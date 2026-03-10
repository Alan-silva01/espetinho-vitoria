import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function syncEspetos() {
    console.log("Iniciando sincronização...");

    // 1. Get the "Espetinhos" category ID
    const { data: catData, error: catErr } = await supabase
        .from('categorias')
        .select('id, nome')
        .eq('nome', 'Espetinhos')
        .single();

    if (catErr || !catData) {
        console.error("Erro ao buscar categoria:", catErr)
        return
    }

    const catId = catData.id;

    // 2. Fetch all Espetinhos
    const { data: espetos, error: prodErr } = await supabase
        .from('produtos')
        .select('id, nome, opcoes_personalizacao')
        .eq('categoria_id', catId);

    if (prodErr || !espetos) {
        console.error("Erro ao buscar produtos:", prodErr)
        return
    }

    // 3. Find the one that has "macaxeira" (case insensitive) in its options
    let sourceEspeto = null;

    for (const esp of espetos) {
        if (!esp.opcoes_personalizacao) continue;
        const optsStr = JSON.stringify(esp.opcoes_personalizacao).toLowerCase();
        if (optsStr.includes('macaxeira frita') || optsStr.includes('macaxeira')) {
            sourceEspeto = esp;
            break;
        }
    }

    if (!sourceEspeto) {
        console.log("Nenhum espeto com macaexeira achado nas opções. Buscando por nome 'Carne'...");
        sourceEspeto = espetos.find(e => e.nome.toLowerCase().includes('carne') && !e.nome.toLowerCase().includes('medalhão'));
        if (!sourceEspeto) {
            console.log("Não achei nem carne. Abortando.");
            return;
        }
    }

    console.log(`Usando como base o produto: ${sourceEspeto.nome}`);
    const sourceOpcoes = sourceEspeto.opcoes_personalizacao || [];

    // The groups we want to sync
    const gruposParaSincronizar = ['Acompanha', 'Adicionais', 'Tipo de Arroz', 'Ponto da Carne'];
    const opcoesSincronizadas = sourceOpcoes.filter(g => gruposParaSincronizar.includes(g.grupo));

    if (opcoesSincronizadas.length === 0) {
        console.log("Nenhum grupo válido para sincronizar na origem.");
        return;
    }

    console.log("Total de espetos para atualizar:", espetos.length - 1);

    // 4. Update the others
    for (const esp of espetos) {
        if (esp.id === sourceEspeto.id) continue;

        const opcoesAtuais = Array.isArray(esp.opcoes_personalizacao) ? esp.opcoes_personalizacao : [];
        const opcoesRestantes = opcoesAtuais.filter(g => !gruposParaSincronizar.includes(g.grupo));

        const novasOpcoes = [...opcoesRestantes, ...opcoesSincronizadas];

        const { error: upErr } = await supabase
            .from('produtos')
            .update({ opcoes_personalizacao: novasOpcoes })
            .eq('id', esp.id);

        if (upErr) {
            console.error(`Erro ao atualizar ${esp.nome}:`, upErr);
        } else {
            console.log(`Acompanhamentos de ${esp.nome} atualizados.`);
        }
    }

    console.log("Pronto! Sincronização concluída.");
}

syncEspetos();
