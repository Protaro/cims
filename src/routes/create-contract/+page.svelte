<script lang="ts">
    import CreateContractMainPanel from "./CreateContractMainPanel.svelte";
    import { Pencil, Check, Save, Search, X, Loader2 } from 'lucide-svelte';
    import { supabase } from "$lib/supabaseInit"; 
    import { uploadFiles, saveFileRecords } from '$lib/fileService';

    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    import { getWorkflows, getWorkflowWithDetails, contractStore } from '$lib/contractdetail';
   
    let workflows = $state<any>([]);
    let selectedWorkflowId = $state('');
    let searchQuery = $state('');
    let showDropdown = $state(false);
    let selectedWorkflow = $derived(workflows.find((w: any) => w.id === selectedWorkflowId) || null);
    let filteredWorkflows = $derived(
        workflows.filter((w: any) => w.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    let { data } = $props();
    let { access , userId} = $derived(data); 
    
    let currentPhase = $state('Prework'); 
    
    let showModal = $state(false);
    let modalTitle = $state("");
    let modalMessage = $state("");
    let showCancelModal = $state(false);
    
    onMount(async () => {
        const { data } = await getWorkflows();
        workflows = data || [];
    });
  
    function selectWorkflow(workflowId: string) {
        showDropdown = false;
        searchQuery = '';
        selectedWorkflowId = workflowId;
        if (!workflowId) return;
        handleWorkflowLoad(workflowId);
    }

    async function handleWorkflowSelect(event: Event) {
        const target = event.target as HTMLSelectElement;
        selectedWorkflowId = target.value;
        if (!selectedWorkflowId) return;
        await handleWorkflowLoad(selectedWorkflowId);
    }

    async function handleWorkflowLoad(workflowId: string) {
        isLoadingTemplate = true;

        const selectedWf = workflows.find((wf: any) => wf.id === workflowId);
        if (selectedWf) {
            ContractName = `New ${selectedWf.name} Contract`;
        }

        const workflow = await getWorkflowWithDetails(workflowId);
        
        const preChecklist = workflow.preworks?.prework_bridge_table?.map((item: any) => ({
            text: item.prework_default_reqs?.name || "Requirement", 
            details: "",
            done: false,
            isCustom: false
        })) || [];

        let rawAppChecklist = workflow.approvals?.checklist;
        let appStages = Array.isArray(rawAppChecklist) ? rawAppChecklist : (rawAppChecklist?.stages || []);
        const appChecklist = appStages.map((stage: any) => ({
            ...stage,
            isCustom: false,
            items: (stage.items || []).map((item: any) => ({ ...item, isCustom: false }))
        }));

        const actParties = (workflow.activations?.parties || []).map((party: any) => ({
            ...party,
            isCustom: false
        }));

        let rawPostChecklist = workflow.postworks?.checklist;
        let pmilestones = Array.isArray(rawPostChecklist) ? rawPostChecklist : (rawPostChecklist?.milestones || []);
        const postChecklist = pmilestones.map((m: any) => ({
            ...m,
            isCustom: false
        }));

        contractStore.update(store => ({
            ...store,
            workflowId: workflow.id,
            prework: { checklist: preChecklist },
            approval: { stages: appChecklist },
            activation: { parties: actParties },
            postwork: { milestones: postChecklist, termination: { type: "", reason: "" } }
        }));
        
        contractData = {
            id: null,
            title: ContractName, 
            workflow_id: selectedWorkflowId,
            prework: { checklist: preChecklist, files: [] },
            approval: { checklist: appChecklist, files: [] },
            activation: { parties: actParties, files: [] },
            postwork: { 
                checklist: postChecklist,
                milestones: postChecklist,
                contractType: "Scholarship",
                contractStatus: "",
                terminationType: "",
                reason: ""
            }
        };

        isLoadingTemplate = false;

    }

    let ContractName = $state("New Contract");
    let isEditing = $state(false);
    let isSaving = $state(false);
    let isLoadingTemplate = $state(false);
    let contractData = $state({
        id: null as string | null,
        title: "",
        workflow_id: "",
        prework: { checklist: [] as any, files: [] as any },
        approval: { checklist:[] as any, files: [] as any },
        activation: { parties: [] as any, files: [] as any },
        postwork: { 
            checklist:[] as any,
            milestones:[],
            contractType: "Scholarship",
            contractStatus: "Active",
            terminationType: "",
            reason: ""
        }
    });

    function startEditing() { isEditing = true; }
    
    function saveName() {
        if (ContractName.trim() !== "") {
            contractData.title = ContractName; 
            isEditing = false;
        }
    }
    
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') saveName();
    }

    async function navigateToWorkflow() {
        const confirmed = window.confirm('Would you like to create a new workflow template based on this contract? The contract will be saved first.');
        if (!confirmed) return;

        await saveContractToDB(true);

        try {
            const { data: prework, error: preworkErr } = await supabase
                .from('preworks')
                .insert({})
                .select()
                .single();
            if (preworkErr) throw preworkErr;

            if (contractData.prework?.checklist?.length > 0) {
                for (const item of contractData.prework.checklist) {
                    const { data: req, error: reqErr } = await supabase
                        .from('prework_default_reqs')
                        .insert({ name: item.text, type: "String" })
                        .select()
                        .single();
                    if (reqErr) {
                        console.error('Failed to insert default req:', reqErr);
                        continue;
                    }
                    const { error: bridgeErr } = await supabase
                        .from('prework_bridge_table')
                        .insert({ prework_id: prework.id, req_id: req.id });
                    if (bridgeErr) {
                        console.error('Failed to insert bridge entry:', bridgeErr);
                    }
                }
            }

            const { data: approval, error: approvalErr } = await supabase
                .from('approvals')
                .insert({ checklist: contractData.approval?.checklist || [] })
                .select()
                .single();
            if (approvalErr) throw approvalErr;

            const { data: activation, error: activationErr } = await supabase
                .from('activations')
                .insert({ parties: contractData.activation?.parties || [] })
                .select()
                .single();
            if (activationErr) throw activationErr;

            const postworkChecklist = {
                milestones: contractData.postwork?.milestones || [],
                termination: {
                    type: contractData.postwork?.terminationType || "",
                    reason: contractData.postwork?.reason || ""
                }
            };
            const { data: postwork, error: postworkErr } = await supabase
                .from('postworks')
                .insert({ checklist: postworkChecklist })
                .select()
                .single();
            if (postworkErr) throw postworkErr;

            const { data: newWorkflow, error: wfError } = await supabase
                .from('workflows')
                .insert({
                    name: `${ContractName} Template`,
                    prework: prework.id,
                    approval: approval.id,
                    activation: activation.id,
                    postwork: postwork.id
                })
                .select()
                .single();
            if (wfError) throw wfError;

            goto(`/workflow?selected=${newWorkflow.id}`, { invalidateAll: true });
        } catch (err: any) {
            console.error('Workflow creation failed:', err);
            window.alert('Failed to create workflow: ' + (err.message || 'Unknown error'));
        }
    }

    async function completeContract() {
        const status = contractData.postwork.contractStatus || "Active";
        await saveContractToDB(false, status);
    }

    async function saveContractToDB(silent = false, statusOverride: string | null = null) {
        console.log(selectedWorkflow);
        isSaving = true;
        const finalTitle = ContractName;
        const finalContractType = selectedWorkflow.name || "Standard";
        const finalContractStatus = statusOverride ?? (contractData.postwork.contractStatus || "On Hold");
        
        const timestamp = new Date().toISOString(); 

        try {
            let contractId = contractData.id;

            if (!contractId) {
                const { data: newContract, error: insertError } = await supabase
                    .from('contracts')
                    .insert({ 
                        title: finalTitle, 
                        type: finalContractType, 
                        status: finalContractStatus, 
                        editors: [userId],
                        viewers: [userId],
                        last_modified: timestamp 
                    })
                    .select('id')
                    .single();
                
                if (insertError) throw insertError;
                contractId = newContract.id;
                contractData.id = contractId; 
            } else {
                const { error: updateError } = await supabase
                    .from('contracts')
                    .update({ 
                        title: finalTitle, 
                        type: finalContractType, 
                        status: finalContractStatus, 
                        editors: [user_group], 
                        viewers: [user_group],
                        last_modified: timestamp
                    })
                    .eq('id', contractId);
                
                if (updateError) throw updateError;
            }

            if (!contractId) throw new Error("Contract ID could not be established.");

            const savePhase = async (tableName: string, payload: any) => {
                const { data: existingRow, error: fetchError } = await supabase
                    .from(tableName).select('id').eq('contract_id', contractId).maybeSingle();

                if (fetchError) throw fetchError;

                if (existingRow) {
                    const { error: updateError } = await supabase.from(tableName).update(payload).eq('id', existingRow.id);
                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabase.from(tableName).insert({ contract_id: contractId, ...payload });
                    if (insertError) throw insertError;
                }
            };

            const currentStore = get(contractStore);

            const cleanPrework = (currentStore.prework?.checklist || []).map((item: any) => {
                const { isCustom, ...rest } = item; return rest;
            });

            const cleanApproval = (currentStore.approval?.stages || []).map((stage: any) => {
                const { isCustom, ...restStage } = stage;
                return {
                    ...restStage,
                    items: (restStage.items || []).map((item: any) => {
                        const { isCustom, ...restItem } = item; return restItem;
                    })
                };
            });

            const cleanActivation = (currentStore.activation?.parties || []).map((party: any) => {
                const { isCustom, ...rest } = party; return rest;
            });

            const cleanMilestones = (contractData.postwork?.milestones || []).map((m: any) => {
                const { isCustom, ...rest } = m; return rest;
            });

            await Promise.all([
                savePhase('contract_preworks', { checklist: cleanPrework }),
                savePhase('contract_approvals', { checklist: { stages: cleanApproval } }),
                savePhase('contract_activations', { parties: cleanActivation }),
                savePhase('contract_postworks', { 
                    checklist: {
                        milestones: cleanMilestones,
                        termination: { type: contractData.postwork?.terminationType || "", reason: contractData.postwork?.reason || "" }
                    } 
                })
            ]);

            // Upload files for each phase
            const stageMappings: { stageType: string; files: File[]; stageId?: string }[] = [
                { stageType: 'prework', files: contractData.prework?.files || [] },
                { stageType: 'approval', files: contractData.approval?.files || [] },
                { stageType: 'activation', files: contractData.activation?.files || [] },
            ];

            for (const mapping of stageMappings) {
                if (mapping.files.length > 0) {
                    const uploadedUrls = await uploadFiles(contractId, mapping.files);
                    await saveFileRecords(mapping.stageType, contractId, uploadedUrls);
                }
            }

            if (!silent) {
                modalTitle = "Success";
                modalMessage = statusOverride ? "Contract completed successfully!" : "Contract saved successfully!"; 
                showModal = true;
            }

        } catch (error: any) {
            console.error("Detailed Saving Error:", error);
            if (!silent) {
                modalTitle = "Error";
                modalMessage = `Save failed: ${error.message || "Internal Database Error"}`;
                showModal = true;
            }
        } finally {
            isSaving = false;
        }
    }
</script>

<div class="main-content">
    <button class="back-link-btn" onclick={() => goto('/view')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        <span>Return to Contract List</span>
    </button>

    <div class="top-action-bar">
        <div class="workflow-header">
                {#if contractData.workflow_id}
                    {#if isEditing}
                        <div class="edit-group">
                            <input 
                                type="text" 
                                bind:value={ContractName} 
                                onkeydown={handleKeydown}
                                class="title-input"
                            />
                            <button class="action-btn save-btn" onclick={saveName}>
                                <Check size={16} strokeWidth={3} />
                            </button>
                        </div>
                    {:else}
                        <div class="view-group">
                            <h1 class="page-title">{ContractName}</h1>
                            <button class="action-btn rename-btn" onclick={startEditing}>
                                <Pencil size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    {/if}
                {:else}
                    <h1 class="page-title">Create Contract</h1>
                {/if}
            </div>

        <div class="header-actions">
            <div class="template-selector">
                <div class="search-wrapper">
                    <input
                        type="text"
                        placeholder="Search templates..."
                        bind:value={searchQuery}
                        onfocus={() => showDropdown = true}
                        onblur={() => setTimeout(() => showDropdown = false, 200)}
                        disabled={currentPhase !== 'Prework'}
                        title={currentPhase !== 'Prework' ? "Template selection is locked after Prework stage" : ""}
                        class="search-input"
                    />
                    <Search size={16} class="search-icon" />
                    {#if showDropdown && filteredWorkflows.length > 0}
                        <div class="search-dropdown">
                            {#each filteredWorkflows as wf}
                                <button
                                    class="dropdown-item"
                                    type="button"
                                    onmousedown={() => selectWorkflow(wf.id)}
                                >
                                    {wf.name}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            {#if contractData.workflow_id}
                <button class="action-btn publish-btn" onclick={() => saveContractToDB()} disabled={isSaving}>
                    {#if isSaving}
                        <Loader2 size={16} class="spin" />
                        <span>Saving...</span>
                    {:else}
                        <Save size={16} strokeWidth={2.5} />
                        <span>Save Contract</span>
                    {/if}
                </button>
                <button class="action-btn cancel-contract-btn" onclick={() => showCancelModal = true}>
                    <X size={16} strokeWidth={2.5} />
                    <span>Cancel Contract</span>
                </button>
                <button class="action-btn workflow-edit-btn" onclick={navigateToWorkflow} disabled={isSaving}>
                    <Pencil size={16} strokeWidth={2.5} />
                    <span>Edit Workflow</span>
                </button>
            {/if}
        </div>
    </div>

    {#if selectedWorkflow}
    <div class="template-preview-card">
        <div class="preview-header">
            <div class="preview-title-group">
                <span class="preview-label">Selected Template</span>
                <h2 class="preview-name">{selectedWorkflow.name}</h2>
            </div>
            {#if currentPhase === 'Prework'}
                <button class="preview-clear-btn" onclick={() => { selectedWorkflowId = ''; searchQuery = ''; contractData = { ...contractData, workflow_id: '' }; }} title="Clear selection">
                    <X size={14} />
                </button>
            {/if}
        </div>
        {#if isLoadingTemplate}
            <div class="preview-loading">Loading template details...</div>
        {:else if contractData.workflow_id}
            <div class="preview-stats">
                <div class="stat-item">
                    <span class="stat-value">{contractData.prework?.checklist?.length || 0}</span>
                    <span class="stat-label">Prework items</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item">
                    <span class="stat-value">{contractData.approval?.checklist?.length || 0}</span>
                    <span class="stat-label">Approval stages</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item">
                    <span class="stat-value">{contractData.activation?.parties?.length || 0}</span>
                    <span class="stat-label">Signing parties</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item">
                    <span class="stat-value">{contractData.postwork?.milestones?.length || 0}</span>
                    <span class="stat-label">Postwork milestones</span>
                </div>
            </div>
        {/if}
    </div>
    {/if}

    <div class="workflow-area">
        {#if contractData.workflow_id}
            {#key contractData.workflow_id}
                <CreateContractMainPanel bind:contractData={contractData} bind:currentPhase={currentPhase} onComplete={completeContract} />
            {/key}
        {:else}
            <div class="empty-state">
                <p>Please select a Workflow Template from the top right to begin.</p>
            </div>
        {/if}
    </div>
</div>

{#if showModal}
    <div class="modal-backdrop">
        <div class="modal">
            <h4 class={modalTitle === 'Success' ? 'title-success' : 'title-error'}>
                {modalTitle}
            </h4>
            <p>{modalMessage}</p>
            <button class="modal-btn" onclick={() => showModal = false}>
                OK
            </button>
        </div>
    </div>
{/if}

{#if showCancelModal}
    <div class="modal-backdrop">
        <div class="modal">
            <h4>Cancel Contract</h4>
            <p>Are you sure you want to cancel? Any unsaved changes will be lost.</p>
            <div class="modal-actions">
                <button class="modal-btn modal-btn-secondary" onclick={() => showCancelModal = false}>
                    Keep Editing
                </button>
                <button class="modal-btn modal-btn-danger" onclick={() => { showCancelModal = false; goto('/view'); }}>
                    Yes, Cancel
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .main-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        width: 100%;
        box-sizing: border-box;
    }

    /* Top Action Bar Styling */
    .top-action-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1.5rem;
        background: white;
        padding: 1.5rem 2rem;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .workflow-header {
        display: flex;
        align-items: center;
    }

    .view-group, 
    .edit-group { 
        display: flex; 
        align-items: center; 
        gap: 1.5rem; 
        flex-wrap: wrap;
    }
    
    .page-title {
        font-family: 'Poppins', sans-serif; 
        font-size: 2rem; 
        font-weight: 700; 
        margin: 0; 
        color: #02461C;
        word-break: break-word;
    }

    .title-input {
        font-family: 'Poppins', sans-serif; 
        font-size: 1.8rem; 
        font-weight: 700; 
        color: #02461C;
        padding: 0 0.5rem; 
        border: 2px solid #7B1113; 
        border-radius: 8px; 
        outline: none; 
        width: 100%; 
        max-width: 350px;
        box-sizing: border-box;
    }

    @media (max-width: 768px) {
        .main-content { padding: 1rem; }
        .page-title { font-size: 1.5rem; }
        .top-action-bar { padding: 1rem; flex-direction: column; align-items: flex-start; }
        .header-actions { width: 100%; }
        .template-selector { width: 100%; }
        .search-wrapper { width: 100%; }
        .search-input { min-width: 0; width: 100%; }
    }

    @media (max-width: 480px) {
        .page-title { font-size: 1.25rem; }
        .title-input { font-size: 1.4rem; max-width: 100%; }
    }

    /* Buttons */
    .action-btn {
        display: flex; 
        align-items: center; 
        gap: 8px; 
        padding: 8px 16px; 
        border: none; 
        border-radius: 9999px;
        cursor: pointer; 
        font-family: 'Poppins', sans-serif; 
        font-weight: 600; 
        font-size: 13px; 
        color: white;
        transition: all 0.2s; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .action-btn:disabled { 
        opacity: 0.6; 
        cursor: not-allowed; 
    }

    .rename-btn { 
        background-color: #7B1113; 
    }

    .rename-btn:hover { 
        background-color: #5a0c0e; 
    }

    .save-btn { 
        background-color: #035a24; 
    }

    .save-btn:hover { 
        background-color: #02451C; 
    }

    .publish-btn { 
        background-color: #1a73e8; 
    }

    .publish-btn:hover { 
        background-color: #1557b0; 
    }

    .workflow-edit-btn {
        background-color: #e8a317;
    }

    .workflow-edit-btn:hover {
        background-color: #c48b12;
    }

    .cancel-contract-btn {
        background-color: #d93025;
    }

    .cancel-contract-btn:hover {
        background-color: #b3261e;
    }

    .back-link-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: none;
        padding: 0 0 0.75rem 0;
        cursor: pointer;
        font-family: 'Poppins', sans-serif;
        font-size: 0.85rem;
        font-weight: 600;
        color: #6b7280;
        transition: color 0.2s;
    }

    .back-link-btn:hover {
        color: #02461C;
    }

    /* Template Search */
    .template-selector {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-input {
        padding: 10px 14px 10px 36px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        font-family: 'Poppins', sans-serif;
        font-size: 0.95rem;
        outline: none;
        min-width: 220px;
        transition: border-color 0.2s;
        box-sizing: border-box;
    }

    .search-input:focus {
        border-color: #02461C;
    }

    .search-input:disabled {
        background-color: #f3f4f6;
        color: #9ca3af;
        cursor: not-allowed;
    }

    .search-input:disabled + .search-icon {
        color: #9ca3af;
    }

    :global(.search-icon) {
        position: absolute;
        left: 10px;
        pointer-events: none;
        color: #6b7280;
        flex-shrink: 0;
    }

    .search-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        z-index: 100;
        max-height: 240px;
        overflow-y: auto;
    }

    .dropdown-item {
        display: block;
        width: 100%;
        padding: 10px 14px;
        border: none;
        background: none;
        text-align: left;
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        cursor: pointer;
        color: #374151;
        transition: background-color 0.15s;
    }

    .dropdown-item:hover,
    .dropdown-item:focus {
        background-color: #f0fdf4;
        color: #02461C;
    }

    .dropdown-item:not(:last-child) {
        border-bottom: 1px solid #f3f4f6;
    }

    /* Template Preview Card */
    .template-preview-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .preview-title-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .preview-label {
        font-family: 'Poppins', sans-serif;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
    }

    .preview-name {
        font-family: 'Poppins', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        color: #02461C;
        margin: 0;
    }

    .preview-clear-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        color: #6b7280;
        transition: all 0.15s;
        flex-shrink: 0;
    }

    .preview-clear-btn:hover {
        border-color: #d93025;
        color: #d93025;
        background: #fef2f2;
    }

    .preview-loading {
        font-family: 'Poppins', sans-serif;
        font-size: 0.85rem;
        color: #9ca3af;
    }

    .preview-stats {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
    }

    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.15rem;
    }

    .stat-value {
        font-family: 'Poppins', sans-serif;
        font-size: 1.3rem;
        font-weight: 700;
        color: #02461C;
    }

    .stat-label {
        font-family: 'Poppins', sans-serif;
        font-size: 0.75rem;
        color: #6b7280;
        white-space: nowrap;
    }

    .stat-divider {
        width: 1px;
        height: 32px;
        background: #e5e7eb;
    }
    
    .empty-state { 
        text-align: center; 
        color: #6b7280; 
        margin-top: 4rem; 
        font-family: 'Poppins', sans-serif; 
        background: white;
        padding: 3rem;
        border-radius: 12px;
        border: 1px dashed #d1d5db;
    }

    /* Modals */
    .modal-backdrop {
        position: fixed;
        top: 0; 
        left: 0; 
        width: 100vw; 
        height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        display: flex; 
        align-items: center; 
        justify-content: center;
        z-index: 9999; 
    }

    .modal {
        background: white;
        padding: 30px;
        border-radius: 12px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }

    .modal h4 { 
        margin-top: 0; 
        margin-bottom: 15px; 
        font-size: 1.25rem; 
    }

    .title-error { 
        color: #7a1a1a; 
    }

    .title-success { 
        color: #035a24; 
    }

    .modal p {
        font-size: 1rem; 
        color: #4b5563;
        margin-bottom: 25px; 
        line-height: 1.5;
    }

    .modal-btn {
        background: #0056b3; 
        color: white; 
        border: none;
        padding: 10px 35px; 
        border-radius: 8px; 
        font-weight: bold;
        cursor: pointer; 
        transition: background-color 0.2s ease;
    }

    .modal-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 20px;
    }

    .modal-btn-secondary {
        background: #6b7280;
    }

    .modal-btn-secondary:hover {
        background: #4b5563;
    }

    .modal-btn-danger {
        background: #d93025;
    }

    .modal-btn-danger:hover {
        background: #b3261e;
    }

    .modal-btn:hover { 
        background: #004494; 
    }
    
    :global(.spin) { 
        animation: spin 1s linear infinite; 
    }

    @keyframes spin { 
        100% { 
            transform: rotate(360deg); 
        } 
    }
</style>