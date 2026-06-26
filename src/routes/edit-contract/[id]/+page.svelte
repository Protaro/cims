<script lang="ts">
    import EditContractMainPanel from "../EditContractMainPanel.svelte"; 
    import { Pencil, Check, Save, Loader2, Users } from 'lucide-svelte';
    import { supabase } from "$lib/supabaseInit"; 
    import { uploadFiles, saveFileRecords } from '$lib/fileService';
    import { onMount } from 'svelte';
    import { contractStore } from '$lib/contractdetail';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    import type { PageData } from './$types';
   
    let { data } = $props();
    let { access, contracts, users, session_id } = $derived(data); 
    
    let currentPhase = $state('Prework'); 
    let isLoadingContract = $state(true);
    
    const contractId = $derived($page.params.id);
    
    let ContractName = $state("Loading Contract...");
    let isEditing = $state(false);
    let isSaving = $state(false);
    let showModal = $state(false);
    let modalTitle = $state("");
    let modalMessage = $state("");
    let showCollaborators = $state(false); // Toggle for Editors/Viewers panel

    let contractData = $state({
        id: null as string | null,
        title: ContractName,
        prework: { checklist: [] as any },
        approval: { checklist: [] as any },
        activation: { parties: [] as any },
        postwork: { 
            checklist: [] as any,
            milestones: [] as any,
            contractType: "",
            contractStatus: "",
            terminationType: "",
            reason: ""
        }
    });

    const currentContract = $derived(contracts?.find((c: any) => c.id === contractId));
    const editors = $derived(currentContract?.editors ?? []);
    const viewers = $derived(currentContract?.viewers ?? []);

    const editorUsers = $derived(users?.filter((u: any) => editors.includes(u.id)) ?? []);
    const viewerUsers = $derived(users?.filter((u: any) => viewers.includes(u.id)) ?? []);
    const availableEditors = $derived(users?.filter((u: any) => !editors.includes(u.id)) ?? []);
    const availableViewers = $derived(users?.filter((u: any) => !viewers.includes(u.id)) ?? []);

    const isEditor = $derived(editorUsers.some((u: any) => u.id === session_id));
    const isViewer = $derived(viewerUsers.some((u: any) => u.id === session_id));

    onMount(async () => {
        if (!contractId) return;

        const { data: selectedContract, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', contractId)
            .single();

        if (error || !selectedContract) {
            ContractName = "Contract not found";
            isLoadingContract = false;
            return;
        }

        ContractName = selectedContract.title;
        
        const [preRes, appRes, actRes, postRes] = await Promise.all([
            supabase.from('contract_preworks').select('checklist').eq('contract_id', contractId).maybeSingle(),
            supabase.from('contract_approvals').select('checklist').eq('contract_id', contractId).maybeSingle(),
            supabase.from('contract_activations').select('parties').eq('contract_id', contractId).maybeSingle(),
            supabase.from('contract_postworks').select('checklist').eq('contract_id', contractId).maybeSingle()
        ]);

        const preChecklist = (preRes.data?.checklist || []).map((item: any) => {
            const { isCustom, ...rest } = item; return rest;
        });

        let rawAppChecklist = appRes.data?.checklist;
        let appStages = Array.isArray(rawAppChecklist) ? rawAppChecklist : (rawAppChecklist?.stages || []);
        const appChecklist = appStages.map((stage: any) => {
            const { isCustom, ...restStage } = stage;
            return {
                ...restStage,
                items: (restStage.items || []).map((item: any) => {
                    const { isCustom, ...restItem } = item; return restItem;
                })
            };
        });

        const actParties = (actRes.data?.parties || []).map((party: any) => {
            const { isCustom, ...rest } = party; return rest;
        });
        
        let rawPostChecklist = postRes.data?.checklist;
        let pmilestones = [];
        let ptermination = { type: "", reason: "" };

        if (Array.isArray(rawPostChecklist)) {
            pmilestones = rawPostChecklist;
        } else if (rawPostChecklist && typeof rawPostChecklist === 'object') {
            pmilestones = rawPostChecklist.milestones || [];
            ptermination = rawPostChecklist.termination || { type: "", reason: "" };
        }

        const postChecklist = pmilestones.map((m: any) => {
            const { isCustom, ...rest } = m; return rest;
        });
        const postTermination = ptermination;

        contractStore.update(store => ({
            ...store,
            workflowId: contractId,
            prework: { checklist: preChecklist },
            approval: { stages: appChecklist },
            activation: { parties: actParties },
            postwork: { milestones: postChecklist, termination: postTermination }
        }));
        
        contractData = {
            id: contractId,
            title: selectedContract.title,
            prework: { checklist: preChecklist },
            approval: { checklist: appChecklist },
            activation: { parties: actParties },
            postwork: { 
                checklist: postChecklist,
                milestones: postChecklist,
                contractType: selectedContract.type || "Scholarship",
                contractStatus: selectedContract.status || "Active",
                terminationType: postTermination.type || "",
                reason: postTermination.reason || ""
            }
        };
        
        isLoadingContract = false;
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

    async function saveContractToDB() {
        if (!contractData.postwork.contractType || contractData.postwork.contractType.trim() === "") {
            modalTitle = "Action Required";
            modalMessage = "Please enter a name for the custom contract type before saving.";
            showModal = true;
            return;
        }

        isSaving = true;
        contractData.title = ContractName;

        const finalContractType = contractData.postwork.contractType;
        const finalContractStatus = contractData.postwork.contractStatus || "Active";

        try {
            if (!contractId) throw new Error("No contract ID available to update.");

            const { error } = await supabase
                .from('contracts')
                .update({ 
                    title: contractData.title,
                    type: finalContractType,
                    status: finalContractStatus,
                    last_modified: new Date().toISOString()
                })
                .eq('id', contractId);
            
            if (error) throw error;

            const savePhase = async (tableName: string, payload: any) => {
                const { data: existingRow, error: fetchError } = await supabase
                    .from(tableName)
                    .select('id')
                    .eq('contract_id', contractId)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                if (existingRow) {
                    return supabase.from(tableName).update(payload).eq('id', existingRow.id);
                } else {
                    return supabase.from(tableName).insert({ contract_id: contractId, ...payload });
                }
            };

            const currentStore = get(contractStore);

            const cleanPrework = currentStore.prework.checklist.map((item: any) => {
                const { isCustom, ...rest } = item; return rest;
            });

            const cleanApproval = currentStore.approval.stages.map((stage: any) => {
                const { isCustom, ...restStage } = stage;
                return {
                    ...restStage,
                    items: (restStage.items || []).map((item: any) => {
                        const { isCustom, ...restItem } = item; return restItem;
                    })
                };
            });

            const cleanActivation = currentStore.activation.parties.map((party: any) => {
                const { isCustom, ...rest } = party; return rest;
            });

            const cleanMilestones = (contractData.postwork.milestones || []).map((m: any) => {
                const { isCustom, ...rest } = m; return rest;
            });

            const results = await Promise.all([
                savePhase('contract_preworks', { checklist: cleanPrework }),
                savePhase('contract_approvals', { checklist: { stages: cleanApproval } }),
                savePhase('contract_activations', { parties: cleanActivation }),
                savePhase('contract_postworks', { 
                    checklist: {
                        milestones: cleanMilestones,
                        termination: {
                            type: contractData.postwork.terminationType,
                            reason: contractData.postwork.reason
                        }
                    } 
                })
            ]);

            const phasesError = results.find(res => res?.error)?.error;
            if (phasesError) throw phasesError;

            // Upload new files for each phase
            const stageMappings: { stageType: string; files: File[] }[] = [
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

            modalTitle = "Success";
            modalMessage = "Contract updated successfully!";
            showModal = true;

        } catch (error) {
            console.error("Error updating contract:", error);
            modalTitle = "Error";
            modalMessage = "Failed to update the contract. Please check the console for details.";
            showModal = true;
        } finally {
            isSaving = false;
        }
    }
</script>

{#if access !== "Workflow Manager" && access !== "Contract Manager"}
    <h1 style="text-align:center; margin-top: 4rem;">You do not have access to view this page. <br> Please contact a Workflow Manager or a Contract Manager.</h1>
{:else}
    <div class="main-content">
        
        {#if isLoadingContract}
            <div class="empty-state">
                <Loader2 size={32} class="spin" style="margin: 0 auto 1rem auto; color: #7B1113;" />
                <p>Loading contract data...</p>
            </div>
        {:else if !contractData.id}
            <div class="empty-state">
                <p>Contract not found or an error occurred.</p>
            </div>
        {:else if !isEditor}
            <div class="empty-state">
                <p>You do not have editor access to this contract. Try viewing it from the View Contracts tab instead!</p>
            </div>
        {:else}
            <div class="workflow-area">
                
                <button class="back-link-btn" onclick={() => goto('/view')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                    <span>Return to Contract List</span>
                </button>
                
                <div class="workflow-header">
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
                                <span>Save Title</span>
                            </button>
                        </div>
                    {:else}
                        <div class="view-group">
                            <h1 class="page-title">{ContractName}</h1>
                            <button class="action-btn rename-btn" onclick={startEditing}>
                                <Pencil size={16} strokeWidth={2.5} />
                                <span>Rename</span>
                            </button>

                            <button class="action-btn outline-btn" onclick={() => showCollaborators = !showCollaborators}>
                                <Users size={16} strokeWidth={2.5} />
                                <span>{showCollaborators ? 'Hide Access' : 'Manage Access'}</span>
                            </button>
                            
                            <button class="action-btn publish-btn" onclick={saveContractToDB} disabled={isSaving}>
                                {#if isSaving}
                                    <Loader2 size={16} class="spin" />
                                    <span>Saving...</span>
                                {:else}
                                    <Save size={16} strokeWidth={2.5} />
                                    <span>Update Contract</span>
                                {/if}
                            </button>
                        </div>
                    {/if}
                </div>

                {#if showCollaborators}
                    <div class="collaborators-panel">
                        <div class="collab-column">
                            <h3>Editors</h3>
                            <div class="collab-list">
                                {#each editorUsers as user}
                                    <div class="collab-item">
                                        <span>{user.username}</span>
                                        <form method="POST" action="?/removeEditor">
                                            <input type="hidden" name="userId" value={user.id} />
                                            <input type="hidden" name="contractId" value={contractData.id} />
                                            <button type="submit" class="text-btn">Remove</button>
                                        </form>
                                    </div>
                                {/each}
                            </div>
                            <form method="POST" action="?/addEditor" class="add-form">
                                <input type="hidden" name="contractId" value={contractData.id} />
                                <select name="userId" required class="select-input">
                                    <option disabled selected value="">Add editor</option>
                                    {#each availableEditors as user}
                                        <option value={user.id}>{user.username}</option>
                                    {/each}
                                </select>
                                <button type="submit" class="action-btn small-btn">Add</button>
                            </form>
                        </div>

                        <div class="collab-column">
                            <h3>Viewers</h3>
                            <div class="collab-list">
                                {#each viewerUsers as user}
                                    <div class="collab-item">
                                        <span>{user.username}</span>
                                        <form method="POST" action="?/removeViewer">
                                            <input type="hidden" name="userId" value={user.id} />
                                            <input type="hidden" name="contractId" value={contractData.id} />
                                            <button type="submit" class="text-btn">Remove</button>
                                        </form>
                                    </div>
                                {/each}
                            </div>
                            <form method="POST" action="?/addViewer" class="add-form">
                                <input type="hidden" name="contractId" value={contractData.id} />
                                <select name="userId" required class="select-input">
                                    <option disabled selected value="">Add viewer</option>
                                    {#each availableViewers as user}
                                        <option value={user.id}>{user.username}</option>
                                    {/each}
                                </select>
                                <button type="submit" class="action-btn small-btn">Add</button>
                            </form>
                        </div>
                    </div>
                {/if}

                {#key contractData.id}
                    <EditContractMainPanel bind:contractData={contractData} bind:currentPhase={currentPhase} />
                {/key}
            </div>
        {/if}
    </div>

    {#if showModal}
        <div class="modal-backdrop">
            <div class="modal">
                <h4 class={modalTitle === 'Success' ? 'title-success' : 'title-error'}>
                    {modalTitle}
                </h4>
                <p>{modalMessage}</p>
                <div class="modal-actions">
                    <button class="modal-btn" onclick={() => showModal = false}>
                        OK
                    </button>
                    {#if modalTitle === 'Success'}
                        <button class="modal-btn modal-btn-return" onclick={() => goto('/view')}>
                            Return to Contract List
                        </button>
                    {/if}
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
        width: 100%;
        box-sizing: border-box;
    }
    
    .workflow-header {
        min-height: 3rem;
        margin-bottom: 1.5rem;
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

    .view-group, 
    .edit-group {
        display: flex;
        align-items: center;
        gap: 1.25rem;
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
        max-width: 450px;
        box-sizing: border-box;
    }

    .publish-btn {
        background-color: #0056b3;
        margin-left: auto;
    }

    @media (max-width: 768px) {
        .main-content { padding: 1rem; }
        .page-title { font-size: 1.5rem; }
        .collaborators-panel { grid-template-columns: 1fr; }
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
        background-color: #0056b3;
        margin-left: auto;
    }

    .publish-btn:hover {
        background-color: #004494;
    }
    
    .outline-btn {
        background-color: transparent;
        border: 2px solid #6b7280;
        color: #4b5563;
        box-shadow: none;
    }

    .outline-btn:hover {
        background-color: #f3f4f6;
        color: #111827;
    }
    
    .collaborators-panel {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 2rem;
    }

    .collab-column h3 {
        font-family: 'Poppins', sans-serif;
        font-size: 1.1rem;
        margin: 0 0 1rem 0;
        color: #374151;
    }

    .collab-list {
        margin-bottom: 1rem;
    }

    .collab-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 0.9rem;
    }

    .text-btn {
        background: none;
        border: none;
        color: #dc2626;
        font-size: 0.8rem;
        cursor: pointer;
        text-decoration: underline;
        padding: 0;
    }

    .add-form {
        display: flex;
        gap: 10px;
    }

    .select-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
    }

    .small-btn {
        padding: 6px 12px;
        background-color: #4b5563;
    }

    .small-btn:hover {
        background-color: #374151;
    }

    /* Layout & Modals */
    .empty-state {
        text-align: center;
        color: #666;
        margin-top: 6rem;
        font-family: 'Poppins', sans-serif;
    }
    
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

    .modal-btn:hover {
        background: #004494;
    }

    .modal-btn-return {
        background: #02461C;
    }

    .modal-btn-return:hover {
        background: #013014;
    }

    .modal-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
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