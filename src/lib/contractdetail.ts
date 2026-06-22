import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseInit';
export interface ContractData {
    name: string;
    workflowId: string | null;
    prework: { checklist: Array<{ text: string; details: string }> };
    approval: { stages: Array<{ name: string; items: Array<{ text: string; done: boolean }> }> };
    activation: { parties: Array<{ name: string; done: boolean }> };
    postwork: { milestones: Array<{ text: string; done: boolean }>; termination?: { type: string; reason: string } };
}

export const contractStore = writable<ContractData>({
    name: 'Contract Name',
    workflowId: null,
    prework: { checklist: [] },
    approval: { stages: [] },
    activation: { parties: [] },
    postwork: { milestones: [] }
});


export async function getWorkflows() {
    const { data, error } = await supabase
        .from('workflows')
        .select('id, name');
    return { data, error };
}

export async function getWorkflowWithDetails(workflowId: string) {
    const { data: workflow } = await supabase
        .from('workflows')
        .select('*, preworks(id,prework_bridge_table(prework_default_reqs(name))), approvals(*), activations(*), postworks(*)')
        .eq('id', workflowId)
        .single();
    return workflow;
}

export async function saveContract(contractData: ContractData) {
    const { data: contract, error } = await supabase
        .from('contracts')
        .insert({ title: contractData.name, status: 'draft', type: 'standard' })
        .select()
        .single();
    
    if (error) return { error };
    
    await Promise.all([
        supabase.from('contract_preworks').insert({
            contract_id: contract.id,
            checklist: contractData.prework.checklist
        }),
        supabase.from('contract_approvals').insert({
            contract_id: contract.id,
            checklist: contractData.approval.stages
        }),
        supabase.from('contract_activations').insert({
            contract_id: contract.id,
            parties: contractData.activation.parties
        }),
        supabase.from('contract_postworks').insert({
            contract_id: contract.id,
            checklist: contractData.postwork.milestones
        })
    ]);
    
    return { data: contract };
}