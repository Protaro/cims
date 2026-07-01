import { supabase } from '$lib/supabaseInit';
import { redirect } from '@sveltejs/kit';
import type {PageServerLoad } from './$types'

export const load : PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const {session} = await safeGetSession()
    if (!session) {
        redirect(303, '/')
    }

    const { data : access } = await supabase
    .from('profiles')
    .select(`access_level`)
    .eq('id', session.user.id)
    .single()

    const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('name');

    if (error) {
        console.error(error);
        return { workflows: [] };
    }

    return {
        access : access?.access_level,
        workflows: data
    };
}

export const actions = {
	update_name: async ({ request }: { request: Request })=> {
		const data = await request.formData();
        const workflow_id = data.get('workflow_id')?.toString()
        const new_name = data.get('new_name')?.toString()

        const { error } = await supabase
        .from('workflows')
        .update({ name: new_name})
        .eq('id', workflow_id)
	},
	add_workflow: async ({ request }: { request: Request }) => {
		const data = await request.formData();
        const new_name = data.get('new_name')?.toString() || 'New Workflow';

        const { data: prework, error: preworkError } = await supabase
            .from('preworks')
            .insert({})
            .select()
            .single();

        if (preworkError) {
            console.error(preworkError);
            return { success: false, error: preworkError.message };
        }

        const { data: approval, error: approvalError } = await supabase
            .from('approvals')
            .insert({})
            .select()
            .single();

        if (approvalError) {
            console.error(approvalError);
            return { success: false, error: approvalError.message };
        }

        const { data: activation, error: activationError } = await supabase
            .from('activations')
            .insert({})
            .select()
            .single();

        if (activationError) {
            console.error(activationError);
            return { success: false, error: activationError.message };
        }

        const { data: postwork, error: postworkError } = await supabase
            .from('postworks')
            .insert({})
            .select()
            .single();

        if (postworkError) {
            console.error(postworkError);
            return { success: false, error: postworkError.message };
        }

        const { data: newWorkflow, error } = await supabase
        .from('workflows')
        .insert({
            name: new_name,
            prework: prework.id,
            approval: approval.id,
            activation: activation.id,
            postwork: postwork.id
        })
        .select()
        .single();

        if (error) {
            console.error(error);
            return { success: false, error: error.message };
        }

        return { success: true, newWorkflowId: newWorkflow?.id };
	},
	remove_workflow: async ({ request }: { request: Request }) => {
		const data = await request.formData();
        const workflow_id = data.get('workflow_id')?.toString();

        if (!workflow_id) {
            return { success: false, error: 'No workflow ID provided' };
        }

        const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflow_id);

        if (error) {
            console.error(error);
            return { success: false, error: error.message };
        }

        return { success: true };
	}
}