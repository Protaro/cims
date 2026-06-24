<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { supabase } from "$lib/supabaseInit"; 
    
    const dispatch = createEventDispatcher();
    interface Props { data: any; }
    let { data = $bindable() }: Props = $props();

    type Milestone = { text: string; done: boolean };

    let milestones = $state<Milestone[]>(
        data.milestones?.length 
            ? [...data.milestones] 
            : []
    );

    let terminationType = $state(data.terminationType || "");
    let reason = $state(data.reason || "");

    let existingTypes: string[] = $state([]);
    let contractType = $state(data.contractType || "");
    let customContractType = $state("");
    let isCustomType = $state(false);
    
    let contractStatus = $state(data.contractStatus || "Draft");
    const existingStatuses = ["Draft", "Active", "On Hold", "Completed", "Terminated"];

    let showError = $state(false);
    let errorMessage = $state("");

    onMount(async () => {
        const { data: contractData, error } = await supabase.from('contracts').select('type');
        if (contractData && !error) {
            const uniqueTypes = [...new Set(contractData.map(d => d.type).filter(Boolean))];
            existingTypes = uniqueTypes as string[];
        }
    });

    $effect(() => {
        data.milestones = milestones;
        
        if (contractStatus !== "Terminated") {
            terminationType = "";
            reason = "";
        }
        
        data.terminationType = terminationType;
        data.reason = reason;
        
        data.contractType = isCustomType ? customContractType : contractType;
        data.contractStatus = contractStatus;
    });

    function handleback() { 
        dispatch("back"); 
    }

    function addMilestone() {
        milestones = [...milestones, { text: `New Milestone`, done: false, isCustom: true }];
    }

    function removeMilestone(index: number) {
        milestones = milestones.filter((_, i) => i !== index);
    }

    function toggleCustomType() {
        isCustomType = !isCustomType;
        if (!isCustomType) customContractType = ""; 
    }

</script>

<div class="phase-container">
    <!-- OUTPUT MILESTONES -->
    <div class="section-card">
        <h3>Output Milestones</h3>
        <div class="checklist-items">
            {#each milestones as m, i}
                <div class="milestone-row">
                    <label class="custom-checkbox">
                        <input type="checkbox" bind:checked={m.done} />
                        <span class="checkmark"></span>
                    </label>
                    {#if m.isCustom}
                        <input
                            type="text"
                            class="editable-text"
                            bind:value={m.text}
                            placeholder="Enter milestone"
                        />
                        <button class="delete-btn" onclick={() => removeMilestone(i)}>
                            ×
                        </button>
                    {:else}
                        <span class="field-text">{m.text}</span>
                    {/if}
                </div>
            {/each}
        </div>

        <button class="pill-button" onclick={addMilestone}>
            + Add Milestone
        </button>
    </div>

    <!-- CONTRACT CLASSIFICATION -->
    <div class="section-card">
        <h3>Contract Classification</h3>

        <div class="form-group">
            <label for="contract-type">Contract Type</label>
            <select id="contract-type" bind:value={contractType} disabled={isCustomType}>
                <option value="" disabled>Select existing type...</option>
                {#each existingTypes as type}
                    <option value={type}>{type}</option>
                {/each}
            </select>
            
            <div class="custom-type-container mt-2">
                {#if isCustomType}
                    <input 
                        type="text" 
                        class="editable-text custom-type-input" 
                        placeholder="Enter new contract type..." 
                        bind:value={customContractType} 
                    />
                {/if}
                <button 
                    class="pill-button" 
                    style="background-color: {isCustomType ? '#4b5563' : '#7a1a1a'}; margin-top: 10px;" 
                    onclick={toggleCustomType}
                >
                    {isCustomType ? "- Cancel Custom Type" : "+ Add Custom Field"}
                </button>
            </div>
        </div>

        <div class="form-group" style="margin-top: 16px;">
            <label for="contract-status">Contract Status</label>
            <select id="contract-status" bind:value={contractStatus}>
                <option value="" disabled>Select status...</option>
                {#each existingStatuses as status}
                    <option value={status}>{status}</option>
                {/each}
            </select>
        </div>
    </div>

    <!-- CONTRACT TERMINATION -->
    {#if contractStatus === "Terminated"}
        <div class="section-card termination-area">
            <h3>Terminate Contract</h3>
            <div class="form-group">
                <label for="term-type">Nature of Termination</label>
                <select id="term-type" bind:value={terminationType}>
                    <option value="">Termination type</option>
                    <option>Immediate</option>
                    <option>With Notice</option>
                </select>
            </div>
            <div class="form-group">
                <textarea 
                    rows="5" 
                    placeholder="Add Reasoning For Termination..." 
                    bind:value={reason}
                ></textarea>
            </div>
        </div>
    {/if}
</div>

<div class="pagenav">
    <button class="back" onclick={handleback}>Return to <br/> Signing & Activation</button>
</div>

{#if showError}
<div class="modal-backdrop">
    <div class="modal">
        <h4>Action Required</h4>
        <p>{errorMessage}</p>
        <button class="modal-btn" onclick={() => showError = false}>OK</button>
    </div>
</div>
{/if}

<style>
    .mt-2 { margin-top: 10px; }
    .custom-type-container { display: flex; flex-direction: column; align-items: flex-start; }
    .custom-type-input { width: 100%; margin-bottom: 8px; }
    
    .pagenav { 
        grid-column: 1 / -1; 
        display: flex; 
        justify-content: space-between; 
        margin-top: 30px; 
    }
    
    .back { 
        flex: 0.14; 
        background: transparent; 
        color: #7a1a1a; 
        border: 2px solid #7a1a1a; 
        padding: 12px 40px; 
        border-radius: 9999px; 
        font-weight: bold; 
        cursor: pointer; 
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease; 
    }
    
    .back:hover { background-color: #7a1a1a; color: white; }
    .back:active  { transform: scale(0.97); }
    
    .phase-container { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 60px; 
        font-family: sans-serif; 
    }
    
    .section-card { 
        display: flex; 
        flex-direction: column; 
        padding: 28px; 
        border: 1px solid #e5e7eb; 
        border-radius: 16px; 
        background: white; 
    }
    
    h3 { 
        font-size: 1rem; 
        margin-bottom: 22px; 
        font-weight: bold; 
        color: #000; 
    }
    
    .checklist-items { 
        display: flex; 
        flex-direction: column; 
        gap: 16px; 
        margin-bottom: 24px; 
    }
    
    .custom-checkbox { 
        display: flex; 
        align-items: center; 
        cursor: pointer; 
        font-size: 0.95rem; 
        color: #374151; 
        user-select: none; 
    }
    
    .custom-checkbox input { display: none; }
    
    .checkmark { 
        height: 20px; 
        width: 20px; 
        border: 2px solid #333; 
        border-radius: 4px; 
        margin-right: 14px; 
        position: relative; 
        flex-shrink: 0; 
    }
    
    .custom-checkbox input:checked + .checkmark { background-color: #333; }
    
    .custom-checkbox input:checked + .checkmark:after { 
        content: ""; 
        position: absolute; 
        left: 6px; 
        top: 2px; 
        width: 5px; 
        height: 10px; 
        border: solid white; 
        border-width: 0 2px 2px 0; 
        transform: rotate(45deg); 
    }
    
    .milestone-row { 
        display: flex; 
        align-items: center; 
        gap: 12px; 
    }
    
    .editable-text { 
        flex: 1; 
        border: 1px solid #e5e7eb; 
        border-radius: 6px; 
        padding: 6px 10px; 
        font-size: 0.95rem; 
    }

    .field-text {
        flex: 1;
        padding: 6px 10px;
        font-size: 0.95rem;
        color: #374151;
    }
    
    .delete-btn { 
        background: #f3f4f6; 
        border: none; 
        border-radius: 6px; 
        padding: 4px 10px; 
        cursor: pointer; 
        font-weight: bold; 
        color: #555; 
    }
    
    .delete-btn:hover { background: #e5e7eb; }
    
    .form-group { 
        display: flex; 
        flex-direction: column; 
        gap: 8px; 
        margin-bottom: 18px; 
    }
    
    .form-group label { 
        font-size: 0.9rem; 
        font-weight: 600; 
        color: #4b5563; 
    }
    
    select, textarea { 
        padding: 12px; 
        border: 1px solid #d1d5db; 
        border-radius: 8px; 
        background-color: #f9fafb; 
        font-size: 0.95rem; 
        outline: none; 
    }
    
    select:disabled { 
        background-color: #e5e7eb; 
        color: #9ca3af; 
        cursor: not-allowed; 
    }
    
    select:focus, textarea:focus { border-color: #7a1a1a; }
    textarea { resize: vertical; }
    
    .pill-button { 
        align-self: flex-start; 
        background-color: #7a1a1a; 
        color: white; 
        border: none; 
        padding: 10px 26px; 
        border-radius: 50px; 
        font-weight: bold; 
        cursor: pointer; 
    }
    
    .pill-button:hover { background-color: #5a1313; }
    
    .modal-backdrop { 
        position: fixed; 
        inset: 0; 
        background: rgba(0, 0, 0, 0.4); 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        z-index: 1000; 
    }
    
    .modal { 
        background: white; 
        padding: 25px 30px; 
        border-radius: 12px; 
        max-width: 360px; 
        text-align: center; 
        box-shadow: 0 10px 25px rgba(0,0,0,0.2); 
    }
    
    .modal h4 { 
        margin-bottom: 10px; 
        font-size: 1.1rem; 
        color: #7a1a1a; 
    }
    
    .modal p { 
        font-size: 0.95rem; 
        color: #555; 
        margin-bottom: 20px; 
    }
    
    .modal-btn { 
        background: #7a1a1a; 
        color: white; 
        border: none; 
        padding: 8px 28px; 
        border-radius: 9999px; 
        font-weight: bold; 
        cursor: pointer; 
    }
</style>