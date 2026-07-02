import { redirect } from '@sveltejs/kit';
import type {PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession }}) => {
    const {session} = await safeGetSession()
    if (!session) {
        redirect(303, '/')
    }

    const { data : access } = await supabase
    .from('profiles')
    .select('access_level, id, user_group')
    .eq('id', session.user.id)
    .single()

    const { data: contracts } = await supabase
        .from('contracts')
        .select('id, editors, viewers');

    const { data: groups } = await supabase
        .from('user_groups')
        .select('id, group_name');

    return {
        access : access?.access_level,
        contracts: contracts ?? [],
        groups: groups ?? [],
        session_id: access?.id,
        user_group: access?.user_group
    };
}

export const actions: Actions = {
    addEditor: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const groupId = form.get('groupId') as string;
        const contractIdsRaw = form.get('contractIds') as string;
        const contractIds: string[] = JSON.parse(contractIdsRaw);
        if (!contractIds || contractIds.length === 0) return { success: true };

        for (const contractId of contractIds) {
            const { data } = await supabase
                .from('contracts')
                .select('editors')
                .eq('id', contractId)
                .single();

            const updated = [...(data?.editors ?? []), groupId];

            await supabase
                .from('contracts')
                .update({ editors: updated })
                .eq('id', contractId);
        }

        return { success: true };
    },

    removeEditor: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const groupId = form.get('groupId') as string;
        const contractIdsRaw = form.get('contractIds') as string;
        const contractIds: string[] = JSON.parse(contractIdsRaw);
        if (!contractIds || contractIds.length === 0) return { success: true };

        for (const contractId of contractIds) {
            const { data } = await supabase
                .from('contracts')
                .select('editors')
                .eq('id', contractId)
                .single();

            const updated = (data?.editors ?? []).filter((id: string) => id !== groupId);

            await supabase
                .from('contracts')
                .update({ editors: updated })
                .eq('id', contractId);
        }

        return { success: true };
    },

    addViewer: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const groupId = form.get('groupId') as string;
        const contractIdsRaw = form.get('contractIds') as string;
        const contractIds: string[] = JSON.parse(contractIdsRaw);
        if (!contractIds || contractIds.length === 0) return { success: true };

        for (const contractId of contractIds) {
            const { data } = await supabase
                .from('contracts')
                .select('viewers')
                .eq('id', contractId)
                .single();

            const updated = [...(data?.viewers ?? []), groupId];

            await supabase
                .from('contracts')
                .update({ viewers: updated })
                .eq('id', contractId);
        }

        return { success: true };
    },

    removeViewer: async ({ request, locals: { supabase } }) => {
        const form = await request.formData();
        const groupId = form.get('groupId') as string;
        const contractIdsRaw = form.get('contractIds') as string;
        const contractIds: string[] = JSON.parse(contractIdsRaw);
        if (!contractIds || contractIds.length === 0) return { success: true };

        for (const contractId of contractIds) {
            const { data } = await supabase
                .from('contracts')
                .select('viewers')
                .eq('id', contractId)
                .single();

            const updated = (data?.viewers ?? []).filter((id: string) => id !== groupId);

            await supabase
                .from('contracts')
                .update({ viewers: updated })
                .eq('id', contractId);
        }

        return { success: true };
    }
};
