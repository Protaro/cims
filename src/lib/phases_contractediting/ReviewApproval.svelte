<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { contractStore } from '$lib/contractdetail';
    import { loadFiles, deleteFile } from '$lib/fileService';
    const dispatch = createEventDispatcher();

    interface Props { data: any; stageId?: string; }
    let { data = $bindable(), stageId = "" }: Props = $props();
	
    type ApprovalItem = { text: string; done: boolean };
    type Stage = { name: string; items: ApprovalItem[]; isCustom?: boolean };
	
    // Split data into preexisting (default) and appendable (custom)
    let defaultStages = $state<Stage[]>(
        $contractStore.approval.stages.filter((s: any) => !s.isCustom)
    );
    let customStages = $state<Stage[]>(
        $contractStore.approval.stages.filter((s: any) => s.isCustom)
    );

    let existingFiles = $state<string[]>([]);
    let newFiles = $state<File[]>([]);
		
    // Combine back together when syncing
    $effect(() => {
        contractStore.update(s => ({
            ...s,
            approval: {
                ...s.approval,
                stages:[...defaultStages, ...customStages] as any 
            }
        }));
        data.files = newFiles;
        data.existingFiles = existingFiles;
    });

    onMount(async () => {
        if (stageId) {
            existingFiles = await loadFiles('approval', stageId);
        }
    });

    let showError = $state(false);
    let errorMessage = $state("");
    let showConfirmModal = $state(false);
	
    function removeCustomStage(stageIndex: number) {
        customStages = customStages.filter((_, i) => i !== stageIndex);
    }
	
    function removeCustomItem(stageIndex: number, itemIndex: number) {
        customStages[stageIndex].items = customStages[stageIndex].items.filter((_, i) => i !== itemIndex);
    }

    function addCustomStage() {
        customStages =[...customStages, { 
            name: "New Stage", 
            isCustom: true, 
            items:[{ text: "New Item", done: false }]
        }];
    }

    function addCustomItem(stageIndex: number) {
        customStages[stageIndex].items =[
            ...customStages[stageIndex].items,
            { text: "New Item", done: false }
        ];
    }

    function handleNext() {
        dispatch("next");
    }

    function handleback() {
        showConfirmModal = false;
        dispatch("back");
    }

    function validateBeforeConfirm() {
        const allStages =[...defaultStages, ...customStages];

        if (allStages.length === 0) {
            errorMessage = "Action Required: Please add at least one review stage.";
            showError = true;
            return;
        }

        const hasEmptyStage = allStages.some(stage => stage.name.trim() === "");
        if (hasEmptyStage) {
            errorMessage = "Stage names cannot be empty.";
            showError = true;
            return;
        }

        const hasEmptyItems = allStages.some(
            stage => stage.items.length === 0 || stage.items.some(item => item.text.trim() === "")
        );
        if (hasEmptyItems) {
            errorMessage = "Each stage must contain at least one approval item.";
            showError = true;
            return;
        }

        showConfirmModal = true;
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            newFiles =[...newFiles, ...Array.from(input.files)];
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer?.files) {
            newFiles =[...newFiles, ...Array.from(event.dataTransfer.files)];
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    function removeNewFile(index: number) {
        newFiles = newFiles.filter((_, i) => i !== index);
    }

    async function deleteExistingFile(index: number) {
        if (!stageId) return;
        const url = existingFiles[index];
        try {
            await deleteFile('approval', stageId, url);
            existingFiles = existingFiles.filter((_, i) => i !== index);
        } catch (err) {
            console.error("Failed to delete file:", err);
        }
    }
</script>

<div class="phase-container">
    <div class="checklist-section">
        
        <!--  DEFAULT PREEXISTING STAGES  -->
        {#if defaultStages.length > 0}
            <h3>Default Approval Checklist</h3>
            {#each defaultStages as stage}
                <div class="stage-box">
                    <div class="checklist-row">
                        <span class="readonly-text stage-title">{stage.name}</span>
                    </div>

                    <div class="nested-items">
                        {#each stage.items as item}
                            <div class="checklist-row">
                                <label class="custom-checkbox">
                                    <input type="checkbox" bind:checked={item.done} />
                                    <span class="checkmark"></span>
                                </label>
                                <input
                                    class="editable-text"
                                    type="text"
                                    bind:value={item.text}
                                    placeholder="Approver Name"
                                />
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
            <hr class="section-divider" />
        {/if}

        <!-- MODIFIABLE/APPENDABLE CUSTOM STAGES -->
        <h3>Additional Approval Stages</h3>
        {#each customStages as stage, si}
            <div class="stage-box">
                <div class="checklist-row">
                    <input
                        class="editable-text stage-title-input"
                        type="text"
                        bind:value={stage.name}
                        placeholder="Stage Name"
                    />
                    <button class="delete-btn" onclick={() => removeCustomStage(si)}>×</button>
                </div>

                <div class="nested-items">
                    {#each stage.items as item, ii}
                        <div class="checklist-row">
                            <label class="custom-checkbox">
                                <input type="checkbox" bind:checked={item.done} />
                                <span class="checkmark"></span>
                            </label>

                            <input
                                class="editable-text"
                                type="text"
                                bind:value={item.text}
                                placeholder="Approver Name"
                            />
                            <button class="delete-btn" onclick={() => removeCustomItem(si, ii)}>×</button>
                        </div>
                    {/each}

                    <button
                        class="add-button-field"
                        onclick={() => addCustomItem(si)}
                    >
                        + Add Approval Item
                    </button>
                </div>
            </div>
        {/each}

        <button class="add-button-field" onclick={addCustomStage}>
            + Add Stage
        </button>
    </div>

    <!-- FILE UPLOAD -->
    <div class="upload-section">
        <div class="upload-header">
            <h3>Add Default Files</h3>
        </div>

        <input type="file" multiple class="hidden-file-input" onchange={handleFileSelect} />

        <div class="drop-zone" role="button" tabindex="0" ondrop={handleDrop} ondragover={handleDragOver} onclick={() => (document.querySelector('.hidden-file-input') as HTMLInputElement)?.click()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { (document.querySelector('.hidden-file-input') as HTMLInputElement)?.click(); } }}>
            <p>
                <button type="button" class="blue-text" onclick={(e) => { e.stopPropagation(); (document.querySelector('.hidden-file-input') as HTMLInputElement)?.click(); }}>Choose file</button> to upload
            </p>
        </div>

        {#each existingFiles as url, i}
        <div class="file-item">
            <a href={url} target="_blank" rel="noopener noreferrer">{url.split('/').pop()}</a>
            <button onclick={() => deleteExistingFile(i)}>×</button>
        </div>
        {/each}

        {#each newFiles as file, i}
        <div class="file-item">
            <a href={URL.createObjectURL(file)} target="_blank" rel="noopener noreferrer">{file.name}</a>
            <button onclick={() => removeNewFile(i)}>×</button>
        </div>
        {/each}
    </div>
    <div class="pagenav">
        <button class="back" onclick={handleback}>Return to <br/> Prework</button>
        <button class="next" onclick={validateBeforeConfirm}>Proceed to <br> Signing and Activation</button>
    </div>

    <!-- MODALS -->
    {#if showError}
        <div class="modal-backdrop">
            <div class="modal">
                <h4>Action Required</h4>
                <p>{errorMessage}</p>
                <button class="modal-btn" onclick={() => showError = false}>
                    OK
                </button>
            </div>
        </div>
    {/if}

    {#if showConfirmModal}
        <div class="modal-overlay">
            <div class="modal-content">
                <h3>Confirmation</h3>
                <p>Are you sure you want to save these approval checks?</p>
                <div class="modal-actions">
                    <button
                        class="cancel-button"
                        onclick={() => showConfirmModal = false}
                    >
                        Cancel
                    </button>
                    <button
                        class="import-button"
                        onclick={handleNext}
                    >
                        Confirm & Proceed
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .phase-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 60px;
        font-family: sans-serif;
    }
    .upload-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    h3 {
        font-size: 1rem;
        margin-bottom: 20px;
        font-weight: bold;
    }

    .checklist-section {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .stage-box {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .nested-items {
        padding-left: 30px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .checklist-row {
        display: flex;
        align-items: center;
        gap: 12px;
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
    
    .delete-btn:hover {
        background: #e5e7eb;
    }

    .custom-checkbox {
        display: flex;
        align-items: center;
        cursor: pointer;
    }

    .custom-checkbox input {
        display: none;
    }

    .checkmark {
        height: 20px;
        width: 20px;
        border: 2px solid #333;
        border-radius: 4px;
        display: inline-block;
        position: relative;
        cursor: pointer;
        flex-shrink: 0;
    }

    .custom-checkbox input:checked + .checkmark {
        background-color: #333;
    }

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
    
    .editable-text {
        flex: 1;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 0.95rem;
    }

    .stage-title-input {
        font-weight: bold;
    }

    /* Fixed Stage Title read-only UI */
    .readonly-text {
        flex: 1;
        padding: 6px 10px;
        font-size: 0.95rem;
        color: #374151; 
    }

    .stage-title {
        font-weight: bold;
        font-size: 1rem;
        color: #111827;
        padding-left: 0;
    }

    .section-divider {
        border: none;
        border-top: 1px solid #e5e7eb;
        margin: 15px 0;
    }

    .add-button-field {
        background-color: #7a1a1a;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 50px;
        font-weight: bold;
        cursor: pointer;
        width: fit-content;
    }

    .drop-zone {
        border: 1px dashed #d1d5db;
        background-color: #f9fafb;
        border-radius: 12px;
        padding: 30px;
        text-align: center;
        margin-bottom: 15px;
    }

    .blue-text {
        color: #3b00ff;
        font-weight: bold;
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
        font: inherit;
    }

    .cancel-button {
        background: white;
        border: 1px solid #e5e7eb;
        padding: 10px 30px;
        border-radius: 8px;
        cursor: pointer;
    }

    .import-button {
        background: #3b00ff; 
        color: white;
        border: none;
        padding: 10px 35px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
    }

    .next, .back {
        background: transparent;
        border: 2px solid;
        padding: 12px 40px;
        border-radius: 9999px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease;
    }

    .next {
        color: #3b00ff;
        border-color: #3b00ff;
    }

    .back {
        color: #7a1a1a;
        border-color: #7a1a1a;
        background-color: transparent;
    }

    .pagenav {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        margin-top: 30px;
    }

    .next:hover {
        background-color: #3b00ff;
        color: white;
    }

    .back:hover {
        background-color: #7a1a1a;
        color: white;
    }

    .next:active, .back:active {
        transform: scale(0.97);
    }

    .modal-backdrop, .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal, .modal-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }

    .modal h4, .modal-content h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #7a1a1a;
        font-size: 1.1rem;
    }

    .modal p, .modal-content p {
        font-size: 0.95rem;
        color: #4b5563;
        margin-bottom: 25px;
        line-height: 1.5;
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

    .modal-actions {
        display: flex;
        justify-content: center;
        gap: 15px;
    }

    .hidden-file-input {
        display: none;
    }

    .file-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f3f4f6;
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 8px;
        font-size: 0.9rem;
    }
</style>