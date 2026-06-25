import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
    params,
    locals: { supabase, safeGetSession }
}) => {

    const { session } = await safeGetSession();

    if (!session) {
        throw redirect(303, '/');
    }

    const { data: access } = await supabase
        .from('profiles')
        .select('access_level, id')
        .eq('id', session.user.id)
        .single();

    const { data: users } = await supabase
        .from('profiles')
        .select('id, username, access_level')
        .in('access_level', ['Workflow Manager', 'Contract Manager']);

    const { data: contract, error: dbError } = await supabase
        .from('contracts')
        .select(`
            *,
            contract_preworks ( checklist ),
            contract_approvals ( checklist ),
            contract_activations ( parties ),
            contract_postworks ( checklist )
        `)
        .eq('id', params.id)
        .single();

    if (dbError) {
        console.error('Supabase Error:', dbError);
    }

    if (dbError || !contract) {
        throw error(404, 'Contract not found');
    }

    const prework =
        contract.contract_preworks?.[0]?.checklist ?? [];

    const approvals =
        contract.contract_approvals?.[0]?.checklist ??
        { stages: [] };

    const activations =
        contract.contract_activations?.[0]?.parties ??
        [];

    const postwork =
        contract.contract_postworks?.[0]?.checklist ??
        {
            milestones: [],
            termination: { type: '', reason: '' }
        };

    const { data: stageFiles } = await supabase
        .from('stage_files')
        .select('stage_type, file_url')
        .eq('stage_id', params.id);

    const fileGroups: Record<string, string[]> = {};
    if (stageFiles) {
        for (const f of stageFiles) {
            const t = f.stage_type;
            if (!fileGroups[t]) fileGroups[t] = [];
            fileGroups[t].push(f.file_url);
        }
    }

    return {
        contract,
        prework,
        approvals,
        activations,
        postwork,
        fileGroups,
        users: users ?? [],
        session_id: access?.id ?? null
    };
};