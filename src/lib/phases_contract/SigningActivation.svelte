<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { contractStore } from '$lib/contractdetail';
    import { loadFiles, deleteFile } from '$lib/fileService';
    const dispatch = createEventDispatcher();

    interface Props { data: any; }
    let { data = $bindable() }: Props = $props();

    type Party = { name: string; done: boolean };
	
    let parties = $state<Party[]>(
        $contractStore.activation.parties.length
            ? [...$contractStore.activation.parties]
            : []
    );

    let existingFiles = $state<string[]>([]);
    let newFiles = $state<File[]>([]);

    $effect(() => {
        contractStore.update(s => ({
            ...s,
            activation: {
                ...s.activation,
                parties
            }
        }));
        data.files = newFiles;
        data.existingFiles = existingFiles;
    });

    onMount(async () => {
        if (data.stageId) {
            existingFiles = await loadFiles('activation', data.stageId);
        }
    });

    let showError = $state(false);
    let errorMessage = $state("");
    let showConfirmModal = $state(false);
	
    function addParty() {
        parties = [...parties, { name: "New Party", done: false }];
    }

    function removeParty(index: number) {
        parties = parties.filter((_, i) => i !== index);
    }

    function handleNext() {
        showConfirmModal = false;
        dispatch("next");
    }

    function handleback() {
        dispatch("back");
    }

    function validateBeforeConfirm() {
        if (parties.length === 0) {
            errorMessage = "Action Required: Please add at least one signing party.";
            showError = true;
            return;
        }

        const hasEmptyParty = parties.some(party => party.name.trim() === "");
        if (hasEmptyParty) {
            errorMessage = "Party names cannot be empty.";
            showError = true;
            return;
        }

        showConfirmModal = true;
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            newFiles = [...newFiles, ...Array.from(input.files)];
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer?.files) {
            newFiles = [...newFiles, ...Array.from(event.dataTransfer.files)];
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    function removeNewFile(index: number) {
        newFiles = newFiles.filter((_, i) => i !== index);
    }

    async function deleteExistingFile(index: number) {
        if (!data.stageId) return;
        const url = existingFiles[index];
        try {
            await deleteFile('activation', data.stageId, url);
            existingFiles = existingFiles.filter((_, i) => i !== index);
        } catch (err) {
            console.error("Failed to delete file:", err);
        }
    }
</script>

<div class="phase-container">
    <div class="checklist-section">
        <h3>Signing & Activation</h3>

        {#each parties as party, i}
            <div class="checklist-row">
                <label class="custom-checkbox">
                    <input type="checkbox" bind:checked={party.done} />
                    <span class="checkmark"></span>
                </label>

                <input
                    class="editable-text"
                    type="text"
                    bind:value={party.name}
                    placeholder="Party Name"
                />

                <button class="delete-btn" onclick={() => removeParty(i)}>
                    ×
                </button>
            </div>
        {/each}

        <button class="add-button-field" onclick={addParty}>
            + Add Party
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
        <button class="back" onclick={handleback}>Return to <br/> Review and Approval</button>
        <button class="next" onclick={validateBeforeConfirm}>Proceed to <br> Postwork </button>
    </div>
</div>

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
        <p>
            Are you sure you want to these parties?
        </p>
        <div class="modal-actions">
            <button class="cancel-button" onclick={() => showConfirmModal = false}>
                Cancel
            </button>
            <button class="import-button" onclick={handleNext}>
                Confirm & Proceed
            </button>
        </div>
    </div>
</div>
{/if}

<style>
    .upload-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .phase-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 60px;
        font-family: sans-serif;
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

    .checklist-row {
        display: flex;
        align-items: center;
        gap: 12px;
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
        border-radius: 12px;
        padding: 30px;
        text-align: center;
        background: #f9fafb;
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

    .next {
        background: transparent;
        color: #3b00ff;
        border: 2px solid #3b00ff;
        flex: 0.14;
        padding: 12px 40px;
        border-radius: 9999px; 
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease;
    }
    
    .back {
        background: transparent;
        color: #7a1a1a;
        border: 2px solid #7a1a1a;
        flex: 0.14;
        padding: 12px 40px;
        border-radius: 9999px; 
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease;
    }

    .pagenav {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;;
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
</style>