<script lang="ts">
    import CreateContractMainPanel from "./CreateContractMainPanel.svelte";
    import { Pencil, Check, Save, Loader2, FileText, ChevronDown, X } from 'lucide-svelte';
    import { supabase } from "$lib/supabaseInit"; 
    import { uploadFiles, saveFileRecords } from '$lib/fileService';

    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    import { getWorkflows, getWorkflowWithDetails, contractStore } from '$lib/contractdetail';
   
    let workflows = $state<any>([]);
    let selectedWorkflowId = $state('');
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
  
    async function handleWorkflowSelect(event: Event) {
        const target = event.target as HTMLSelectElement;
        selectedWorkflowId = target.value;
        if (!selectedWorkflowId) return;
        
        isLoadingTemplate = true;

        const selectedWf = workflows.find((wf: any) => wf.id === selectedWorkflowId);
        if (selectedWf) {
            ContractName = `New ${selectedWf.name} Contract`;
        }

        const workflow = await getWorkflowWithDetails(selectedWorkflowId);
        
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
            prework: { checklist: preChecklist },
            approval: { checklist: appChecklist },
            activation: { parties: actParties },
            postwork: { 
                checklist: postChecklist,
                milestones: postChecklist,
                contractType: "Scholarship",
                contractStatus: "Draft",
                terminationType: "",
                reason: ""
            }
        };

        isLoadingTemplate = false;

        autoSaveDraft();
    }

    async function autoSaveDraft() {
        if (!selectedWorkflowId || draftContractId) return;
        isSavingDraft = true;
        try {
            const timestamp = new Date().toISOString();
            const { data: newContract, error } = await supabase
                .from('contracts')
                .insert({
                    title: ContractName,
                    type: contractData.postwork.contractType || "Scholarship",
                    status: 'Draft',
                    editors: [userId],
                    viewers: [userId],
                    last_modified: timestamp
                })
                .select('id')
                .single();

            if (error) throw error;
            draftContractId = newContract.id;
            contractData.id = newContract.id;
            draftSaved = true;
        } catch (err) {
            console.error("Draft auto-save failed:", err);
        } finally {
            isSavingDraft = false;
        }
    }

    let ContractName = $state("New Contract");
    let isEditing = $state(false);
    let isSaving = $state(false);
    let isLoadingTemplate = $state(false);
    let isSavingDraft = $state(false);
    let draftSaved = $state(false);
    let draftContractId = $state<string | null>(null);

    let contractData = $state({
        id: null as string | null,
        workflow_id: "",
        prework: { checklist: [] as any },
        approval: { checklist:[] as any },
        activation: { parties: [] as any },
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
        await saveContractToDB(true);
        goto('/workflow');
    }

    async function completeContract() {
        const status = contractData.postwork.contractStatus || "Active";
        await saveContractToDB(false, status);
    }

    async function saveContractToDB(silent = false, statusOverride: string | null = null) {
        isSaving = true;
        const finalTitle = ContractName;
        const finalContractType = contractData.postwork.contractType || "Scholarship";
        const finalContractStatus = statusOverride ?? "Draft";
        
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
                        editors: [userId], 
                        viewers: [userId],
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

            draftSaved = true;
            draftContractId = contractId;

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

    {#if access !== "Workflow Manager" && access !== "Contract Manager"}
    <h1 style="text-align:center; margin-top: 4rem;">You do not have access to view this page. <br> Please contact a Workflow Manager or a Contract Manager.</h1>
{:else}
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
                <div class="select-wrapper">
                    <select 
                        id="workflow" 
                        bind:value={selectedWorkflowId} 
                        onchange={handleWorkflowSelect}
                        disabled={currentPhase !== 'Prework'} 
                        title={currentPhase !== 'Prework' ? "Template selection is locked after Prework stage" : ""}
                        class="custom-select"
                    >
                        <option value="" disabled selected>Select a template...</option>
                        {#each workflows as wf}
                            <option value={wf.id}>{wf.name}</option>
                        {/each}
                    </select>
                    <ChevronDown size={16} class="select-chevron" />
                </div>
                
                {#if isLoadingTemplate || isSavingDraft}
                    <Loader2 size={18} class="spin inline-icon" style="color: #6b7280;"/>
                {:else if draftSaved}
                    <FileText size={16} style="color: #6b7280;" title="Draft saved" />
                {/if}
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
        .template-selector select { min-width: 0; width: 100%; }
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

    /* Template Selector */
    .template-selector { 
        display: flex; 
        align-items: center; 
        gap: 0.5rem; 
    }
    
    .template-selector select { 
        padding: 10px 14px; 
        border-radius: 8px; 
        border: 1px solid #d1d5db; 
        font-family: 'Poppins', sans-serif;
        font-size: 0.95rem;
        outline: none;
        cursor: pointer;
        min-width: 200px;
        transition: border-color 0.2s;
    }

    .template-selector select:focus {
        border-color: #02461C;
    }

    .template-selector select:disabled {
        background-color: #f3f4f6;
        color: #9ca3af;
        cursor: not-allowed;
    }

    .select-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .custom-select {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        padding-right: 36px;
        width: 100%;
    }

    :global(.select-chevron) {
        position: absolute;
        right: 12px;
        pointer-events: none;
        color: #6b7280;
        flex-shrink: 0;
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