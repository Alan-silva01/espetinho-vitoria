-- ============================================================
-- FUNÇÃO: decrementar_estoque_arroz
-- Decrementa o estoque dos tipos de arroz ao finalizar pedido
-- Usa SECURITY DEFINER para contornar o RLS da tabela produtos
-- ============================================================

-- Garante que a extensão unaccent existe
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.decrementar_estoque_arroz(rice_choices JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    prod RECORD;
    rice_name TEXT;
    rice_qty INT;
    updated_opts JSONB;
    group_idx INT;
    opt_idx INT;
    opt_obj JSONB;
    current_qty INT;
    new_qty INT;
    changed BOOLEAN;
    opt_nome TEXT;
    opt_nome_norm TEXT;
    rice_name_norm TEXT;
BEGIN
    -- Para cada produto da categoria Espetinhos que tem grupo "Tipo de Arroz"
    FOR prod IN
        SELECT p.id, p.opcoes_personalizacao
        FROM produtos p
        JOIN categorias c ON c.id = p.categoria_id
        WHERE c.nome = 'Espetinhos'
        AND p.opcoes_personalizacao IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.opcoes_personalizacao) g
            WHERE g->>'grupo' = 'Tipo de Arroz'
        )
    LOOP
        updated_opts := prod.opcoes_personalizacao;
        changed := FALSE;

        -- Encontrar o índice do grupo "Tipo de Arroz"
        FOR group_idx IN 0..jsonb_array_length(updated_opts) - 1 LOOP
            IF updated_opts->group_idx->>'grupo' = 'Tipo de Arroz' THEN
                
                -- Para cada tipo de arroz pedido
                FOR rice_name, rice_qty IN
                    SELECT key, value::int FROM jsonb_each_text(rice_choices)
                LOOP
                    -- Normalizar o nome do arroz pedido (sem acentos, minúsculo)
                    rice_name_norm := lower(unaccent(rice_name));

                    -- Procurar a opção correspondente
                    FOR opt_idx IN 0..jsonb_array_length(updated_opts->group_idx->'opcoes') - 1 LOOP
                        opt_obj := updated_opts->group_idx->'opcoes'->opt_idx;
                        opt_nome := opt_obj->>'nome';
                        
                        IF opt_nome IS NULL THEN CONTINUE; END IF;
                        
                        opt_nome_norm := lower(unaccent(opt_nome));

                        -- Match: comparação exata normalizada OU ambos contêm "baiao"
                        IF opt_nome_norm = rice_name_norm
                           OR (opt_nome_norm LIKE '%baiao%' AND rice_name_norm LIKE '%baiao%')
                        THEN
                            -- Só decrementar se quantidade está definida e > 0
                            IF opt_obj->>'quantidade' IS NOT NULL THEN
                                current_qty := (opt_obj->>'quantidade')::int;
                                
                                IF current_qty > 0 THEN
                                    new_qty := GREATEST(0, current_qty - rice_qty);
                                    
                                    -- Atualizar quantidade
                                    opt_obj := jsonb_set(opt_obj, '{quantidade}', to_jsonb(new_qty));
                                    
                                    -- Se zerou, desabilitar
                                    IF new_qty = 0 THEN
                                        opt_obj := jsonb_set(opt_obj, '{disponivel}', 'false'::jsonb);
                                    END IF;
                                    
                                    -- Colocar de volta no array
                                    updated_opts := jsonb_set(
                                        updated_opts,
                                        ARRAY[group_idx::text, 'opcoes', opt_idx::text],
                                        opt_obj
                                    );
                                    changed := TRUE;
                                END IF;
                            END IF;
                        END IF;
                    END LOOP;
                END LOOP;
                
                EXIT; -- Já encontrou o grupo, não precisa continuar
            END IF;
        END LOOP;

        -- Atualizar o produto se houve mudança
        IF changed THEN
            UPDATE produtos SET opcoes_personalizacao = updated_opts WHERE id = prod.id;
        END IF;
    END LOOP;
END;
$$;

-- Dar permissão para anon e authenticated chamarem a função
GRANT EXECUTE ON FUNCTION public.decrementar_estoque_arroz(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.decrementar_estoque_arroz(JSONB) TO authenticated;
