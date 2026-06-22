import { redirect } from '@sveltejs/kit';
import type {PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession }}) => {
    const {session} = await safeGetSession()
    if (!session) {
        redirect(303, '/')
    }

    const { data : access } = await supabase
    .from('profiles')
    .select('access_level, id')
    .eq('id', session.user.id)
    .single()

    const { data: contracts } = await supabase
        .from('contracts')
        .select('id, editors, viewers');

    const { data: users } = await supabase
        .from('profiles')
        .select('id, username, access_level')
        .in('access_level', ['Workflow Manager', 'Contract Manager']);

    return {
        access : access?.access_level,
        contracts: contracts ?? [],
        users: users ?? [],
        session_id: access?.id
    };

//    return {
//        access : access?.access_level,
//        editors: contract?.editors ?? [],
//        viewers: contract?.viewers ?? [],
//        users: users ?? []
//    };
}

export const actions = {
    addEditor: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const userId = form.get('userId') as string;
        const contractId = form.get('contractId') as string;

        const { data } = await supabase
            .from('contracts')
            .select('editors')
            .eq('id', contractId)
            .single();

        const updated = [...(data?.editors ?? []), userId];

        await supabase
            .from('contracts')
            .update({ editors: updated })
            .eq('id', contractId);

        return { success: true };
    },

    removeEditor: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const userId = form.get('userId') as string;
        const contractId = form.get('contractId') as string;

        const { data } = await supabase
            .from('contracts')
            .select('editors')
            .eq('id', contractId)
            .single();

        const updated = (data?.editors ?? []).filter((id: string) => id !== userId);

        await supabase
            .from('contracts')
            .update({ editors: updated })
            .eq('id', contractId);

        return { success: true };
    },

    addViewer: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const userId = form.get('userId') as string;
        const contractId = form.get('contractId') as string;

        const { data } = await supabase
            .from('contracts')
            .select('viewers')
            .eq('id', contractId)
            .single();

        const updated = [...(data?.viewers ?? []), userId];

        await supabase
            .from('contracts')
            .update({ viewers: updated })
            .eq('id', contractId);

        return { success: true };
    },

    removeViewer: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const userId = form.get('userId') as string;
        const contractId = form.get('contractId') as string;

        const { data } = await supabase
            .from('contracts')
            .select('viewers')
            .eq('id', contractId)
            .single();

        const updated = (data?.viewers ?? []).filter((id: string) => id !== userId);

        await supabase
            .from('contracts')
            .update({ viewers: updated })
            .eq('id', contractId);

        return { success: true };
    }
};