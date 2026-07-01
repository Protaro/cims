import { supabase } from '$lib/supabaseInit';
import { redirect, fail } from '@sveltejs/kit';
import type {PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession }}) => {
	const {session} = await safeGetSession()
    if (!session) {
        redirect(303, '/')
    }

    const { data : access } = await supabase
    .from('profiles')
    .select(`access_level, id`)
    .eq('id', session.user.id)
    .single()

	const { data, error } = await supabase
    .from('contracts')
    .select(`
        *,
        editors,
        viewers
    `);

	if (error) {
		console.error(error);
		return { contracts: [], filters: { year: '', type: '', status: '', search: '' }};
	}

	const { data: users } = await supabase
        .from('profiles')
        .select('id, username, access_level')
        .in('access_level', ['Workflow Manager', 'Contract Manager']);

	return {
		access : access?.access_level,
		contracts: data,
		filters: { year: '', type: '', status: '', search: '' },
		session_id: access?.id,
		users: users ?? []
	};
};

export const actions: Actions = {
	deleteContract: async ({ request, locals: { supabase: serverSupabase } }) => {
		const form = await request.formData();
		const contractId = form.get('contractId') as string;
		if (!contractId) return fail(400, { error: 'Contract ID required' });

		const { error } = await serverSupabase
			.from('contracts')
			.delete()
			.eq('id', contractId);

		if (error) {
			console.error('Delete error:', error);
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	deleteContracts: async ({ request, locals: { supabase: serverSupabase } }) => {
		const form = await request.formData();
		const ids = form.get('contractIds') as string;
		if (!ids) return fail(400, { error: 'Contract IDs required' });

		const contractIds = JSON.parse(ids);
		if (!Array.isArray(contractIds) || contractIds.length === 0) {
			return fail(400, { error: 'No valid contract IDs' });
		}

		const { error } = await serverSupabase
			.from('contracts')
			.delete()
			.in('id', contractIds);

		if (error) {
			console.error('Bulk delete error:', error);
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	addEditor: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();

    const contractId = form.get('contractId') as string;
    const userId = form.get('userId') as string;

    const { data: contract } = await supabase
        .from('contracts')
        .select('editors')
        .eq('id', contractId)
        .single();

    const editors = [...(contract?.editors ?? [])];

    if (!editors.includes(userId)) {
        editors.push(userId);
    }

    await supabase
        .from('contracts')
        .update({ editors })
        .eq('id', contractId);

    return { success: true };
},

removeEditor: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();

    const contractId = form.get('contractId') as string;
    const userId = form.get('userId') as string;

    const { data: contract } = await supabase
        .from('contracts')
        .select('editors')
        .eq('id', contractId)
        .single();

    const editors =
        (contract?.editors ?? [])
            .filter((id:string) => id !== userId);

    await supabase
        .from('contracts')
        .update({ editors })
        .eq('id', contractId);

    return { success: true };
},

addViewer: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();

    const contractId = form.get('contractId') as string;
    const userId = form.get('userId') as string;

    const { data: contract } = await supabase
        .from('contracts')
        .select('viewers')
        .eq('id', contractId)
        .single();

    const viewers = [...(contract?.viewers ?? [])];

    if (!viewers.includes(userId)) {
        viewers.push(userId);
    }

    await supabase
        .from('contracts')
        .update({ viewers })
        .eq('id', contractId);

    return { success: true };
},

removeViewer: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();

    const contractId = form.get('contractId') as string;
    const userId = form.get('userId') as string;

    const { data: contract } = await supabase
        .from('contracts')
        .select('viewers')
        .eq('id', contractId)
        .single();

    const viewers =
        (contract?.viewers ?? [])
            .filter((id:string) => id !== userId);

    await supabase
        .from('contracts')
        .update({ viewers })
        .eq('id', contractId);

    return { success: true };
},
};
