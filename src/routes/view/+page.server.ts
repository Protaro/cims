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
    .select(`access_level, id, user_group`)
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

	const { data: groups } = await supabase
        .from('user_groups')
        .select('id, group_name');

	return {
		access : access?.access_level,
		contracts: data,
		filters: { year: '', type: '', status: '', search: '' },
		session_id: access?.id,
		user_group: access?.user_group,
		groups: groups ?? []
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

    const contractIdsRaw = form.get('contractIds') as string;
    const groupId = form.get('groupId') as string;

    const contractIds: string[] = JSON.parse(contractIdsRaw);
    if (!contractIds || contractIds.length === 0) return fail(400, { error: 'Contract IDs required' });

    for (const id of contractIds) {
        const { data: contract } = await supabase
            .from('contracts')
            .select('editors')
            .eq('id', id)
            .single();

        const editors = [...(contract?.editors ?? [])];

        // if (!editors.includes(groupId)) {
        //     editors.push(groupId);
        // }

        const { data: editorsInGroup } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_group', parseInt(groupId, 10))
        
        const usersToAdd = (editorsInGroup ?? []).map(user => user.id);
        console.log(usersToAdd)
        
        for (const e of usersToAdd) {
            if(!editors.includes(e)) {
                editors.push(e);
            }
        }

        await supabase
            .from('contracts')
            .update({ editors })
            .eq('id', id);
    }

    return { success: true };
},

removeEditor: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();

    const contractIdsRaw = form.get('contractIds') as string;
    const groupId = form.get('groupId') as string;

    const contractIds: string[] = JSON.parse(contractIdsRaw);
    if (!contractIds || contractIds.length === 0) return fail(400, { error: 'Contract IDs required' });

    for (const id of contractIds) {
        const { data: contract } = await supabase
            .from('contracts')
            .select('editors')
            .eq('id', id)
            .single();

        let editors = [...(contract?.editors ?? [])];

        editors = editors.filter((id: string) => id !== groupId);

        await supabase
            .from('contracts')
            .update({ editors })
            .eq('id', id);
    }

    return { success: true };
},

addViewer: async ({ request, locals: { supabase } }) => {
    console.log("addViewer func reached, contractIds are:")
    const form = await request.formData();

    const contractIdsRaw = form.get('contractIds') as string;
    const groupId = form.get('groupId') as string;

    const contractIds: string[] = JSON.parse(contractIdsRaw);

    console.log(contractIds)
    console.log(`groupId to add is ${groupId}`)

    if (!contractIds || contractIds.length === 0) return fail(400, { error: 'Contract IDs required' });

    for (const id of contractIds) {
        const { data: contract } = await supabase
            .from('contracts')
            .select('viewers')
            .eq('id', id)
            .single();

        let viewers = [...(contract?.viewers ?? [])];
        console.log(`current viewers are: ${viewers}`)

        const { data: viewersInGroup } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_group', parseInt(groupId, 10))
        
        const usersToAdd = (viewersInGroup ?? []).map(user => user.id);
        console.log(usersToAdd)
        
        for (const e of usersToAdd) {
            if(!viewers.includes(e)) {
                viewers.push(e);
            }
        }

        await supabase
            .from('contracts')
            .update( { viewers } )
            .eq('id', id);
        
        console.log(viewers)

        // if (!viewers.includes(groupId)) {
        //     viewers.push(groupId);
        // }
        

        // await supabase
        //     .from('contracts')
        //     .update({ viewers })
        //     .eq('id', id);
    }
    console.log("reached")
    return { success: true };
},

removeViewer: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();

    const contractIdsRaw = form.get('contractIds') as string;
    const groupId = form.get('groupId') as string;

    const contractIds: string[] = JSON.parse(contractIdsRaw);
    if (!contractIds || contractIds.length === 0) return fail(400, { error: 'Contract IDs required' });

    for (const id of contractIds) {
        const { data: contract } = await supabase
            .from('contracts')
            .select('viewers')
            .eq('id', id)
            .single();

        const viewers =
            (contract?.viewers ?? [])
                .filter((gid:string) => gid !== groupId);

        await supabase
            .from('contracts')
            .update({ viewers })
            .eq('id', id);
    }

    return { success: true };
},
};
