<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { contractStore } from '$lib/contractdetail';
    import { loadFiles, deleteFile } from '$lib/fileService';
    const dispatch = createEventDispatcher();

    interface Props { data: any; stageId?: string; }
    let { data = $bindable(), stageId = "" }: Props = $props();

    type Item = { text: string; done: boolean; details: string };

    let checklist = $state<Item[]>(
        $contractStore.prework.checklist.length > 0
            ? $contractStore.prework.checklist.map((item: any) => ({ ...item, details: item.details || "" }))
            :[]
    );
    
    let lastWorkflowId = $state($contractStore.workflowId);
    let existingFiles = $state<string[]>([]);
    let newFiles = $state<File[]>(data.files || []);

    onMount(async () => {
        if (stageId) {
            existingFiles = await loadFiles('prework', stageId);
        }
    });

    $effect(() => {
        if ($contractStore.workflowId !== lastWorkflowId) {
            lastWorkflowId = $contractStore.workflowId;
            checklist = ($contractStore.prework.checklist ||[]).map((item: any) => ({ 
                ...item, 
                details: item.details || "" 
            }));
            existingFiles = [];
            newFiles = [];
        }
    });

    $effect(() => {
        data.checklist = checklist;
        data.files = newFiles;
        data.existingFiles = existingFiles;
        contractStore.update(s => ({ ...s, prework: { checklist } }));
    });

    let showConfirmModal = $state(false);
    let isSaving = $state(false);

    function validateBeforeConfirm() {
        showConfirmModal = true;
    }

    function handleNext() {
        showConfirmModal = false;
        dispatch("next");
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
            await deleteFile('prework', stageId, url);
            existingFiles = existingFiles.filter((_, i) => i !== index);
        } catch (err) {
            console.error("Failed to delete file:", err);
        }
    }
</script>

<div class="phase-container">
    <!-- CHECKLIST -->
    <div class="checklist-section">
        <h3>Requirements Checklist</h3>

        <div class="checklist-items">
            {#each checklist as item, i}
                <div class="checklist-item-wrapper">
                    <!-- MAIN ROW  -->
                    <div class="checklist-row">
                        <div class="readonly-text main-input">
                            {item.text || "Unnamed Requirement"}
                        </div>
                    </div>

                    <!-- DETAILS ROW  -->
                    <div class="details-row">
                        <input
                            class="editable-text details-input"
                            type="text"
                            bind:value={item.details}
                            placeholder="Add requirement details or context..."
                        />
                    </div>
                </div>
            {/each}
        </div>
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

    <!-- PAGE NAVIGATION -->
    <div class="pagenav">
        <button class="next" onclick={validateBeforeConfirm}>Proceed to <br/> Approval and review</button>
    </div>

    <!-- MODALS -->
    {#if showConfirmModal}
        <div class="modal-overlay">
            <div class="modal-content">
                <h3>Confirmation</h3>
                <p>Are you sure you want to save these requirements?</p>
                <div class="modal-actions">
                    <button
                        class="cancel-button"
                        onclick={() => showConfirmModal = false}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        class="import-button"
                        onclick={handleNext}
                        disabled={isSaving}
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
        background: white;
        font-family: sans-serif;
    }

    h3 {
        font-size: 1rem;
        margin-bottom: 20px;
        font-weight: bold;
    }

    .checklist-items {
        display: flex;
        flex-direction: column;
        gap: 20px; 
        margin-bottom: 25px;
    }

    .checklist-item-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .checklist-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .details-row {
        display: flex;
        padding-left: 10px;
    }

    .readonly-text {
        flex: 1;
        border: 1px solid #e5e7eb;
        background-color: #f3f4f6;
        color: #4b5563;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: not-allowed;
    }

    .editable-text {
        flex: 1;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 0.95rem;
    }

    .details-input {
        background-color: #ffffff;
        font-size: 0.9rem;
    }

    .details-input::placeholder {
        color: #9ca3af;
        font-style: italic;
    }

    .upload-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .drop-zone {
        border: 1px dashed #d1d5db;
        background-color: #f9fafb;
        border-radius: 12px;
        padding: 30px;
        text-align: center;
        margin-bottom: 15px;
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
        padding: 8px 28px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
    }

    .next {
        flex: 0.14;
        background: transparent;
        color: #3b00ff;
        border: 2px solid #3b00ff;
        padding: 12px 40px;
        border-radius: 9999px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease;
    }

    .pagenav {
        grid-column: 1 / -1;
        display: flex;
        justify-content: right;
        margin-top: 30px;
    }

    .next:hover {
        background-color: #3b00ff;
        color: white;
    }

    .next:active {
        transform: scale(0.97);
    }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        width: 400px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        text-align: center;
    }

    .modal-content h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #7a1a1a;
    }

    .modal-content p {
        color: #4b5563;
        margin-bottom: 25px;
        line-height: 1.5;
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

    .file-item button {
        background: transparent;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: #6b7280;
    }

    .file-item button:hover {
        color: #dc2626;
    }

    .blue-text {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        color: #3b00ff;
        font-weight: bold;
        cursor: pointer;
    }
</style>