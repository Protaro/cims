<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
        blur,
        crossfade,
        draw,
        fade,
        fly,
        scale,
        slide
    } from 'svelte/transition';
  import { supabase } from "$lib/supabaseInit"; 
  import { uploadFiles, saveFileRecords, loadFiles, deleteFile } from '$lib/fileService';

  export let preworkId: string; 

  type Item = { 
      text: string; 
      done: boolean; 
      id?: number; 
      reqType: string; 
  };

  let isSaving = false;
  let isLoading = true;
  let showConfirmModal = false;
  let files: File[] = [];
  let newFiles: File[] = [];
  let existingFiles: string[] = [];


  // Store dictionary reqs from the DB
  let availableReqs: { id: number, name: string, type: string }[] =[];
  let selectedExistingId: number | '' = '';

  let checklist: Item[] =[];

  const dispatch = createEventDispatcher();

  // Fetch dictionary when page first loads
  onMount(async () => {
    const { data: allReqs } = await supabase
        .from('prework_default_reqs')
        .select('*')
        .order('name');
    
    if (allReqs) availableReqs = allReqs;
  });

  // updates checklist when you click a different workflow
  $: if (preworkId) {
      loadChecklist(preworkId);

      loadFiles('prework', preworkId).then(files => {
        existingFiles = files;
    });
  }

  // loading logic
  async function loadChecklist(currentId: string) {
    isLoading = true;
    checklist =[]; // clear checklist

    const { data, error } = await supabase
      .from('prework_bridge_table')
      .select(`
        req_id,
        prework_default_reqs ( id, name, type )
      `)
      .eq('prework_id', currentId);

    if (error) {
        console.error("Error fetching prework data:", error);
    } else if (data && data.length > 0) {
        checklist = data.map(row => {
            const req = row.prework_default_reqs as any;
            return {
                id: req.id,
                text: req.name,
                done: true,
                reqType: req.type
            };
        });
    }
    isLoading = false;
  }

  async function deleteExistingFile(index: number) {
    const fileUrl = existingFiles[index];

    try {
        const url = new URL(fileUrl);
        const path = url.pathname.split('/storage/v1/object/public/stage-files/')[1];

        const { error: storageError } = await supabase.storage
            .from('stage-files')
            .remove([path]);

        if (storageError) throw storageError;

        const { error: dbError } = await supabase
            .from('prework_files')
            .delete()
            .eq('file_url', fileUrl);

        if (dbError) throw dbError;

        existingFiles = existingFiles.filter((_, i) => i !== index);

    } catch (err) {
        console.error("Delete failed:", err);
        alert("Failed to delete file.");
    }
}

  function addNewField() {
    checklist =[...checklist, { text: "", done: false, reqType: "String" }];
  }

  function addExistingField() {
    if (!selectedExistingId) return;
    
    const req = availableReqs.find(r => r.id === selectedExistingId);
    
    if (req && !checklist.some(c => c.id === req.id)) {
        checklist =[...checklist, { 
            id: req.id, 
            text: req.name, 
            done: false, 
            reqType: req.type 
        }];
    }
    selectedExistingId = ''; // reset selection
  }

  function removeField(index: number) {
    checklist = checklist.filter((_, i) => i !== index);
  }

  // save logic
  async function handleNext() {
    if (!preworkId) {
        alert("Missing Prework ID. Cannot save.");
        showConfirmModal = false;
        return;
    }

    const validChecklist = checklist.filter(item => item.id || item.text.trim() !== "");
    isSaving = true;

    try {
        const existingItems = validChecklist.filter(item => item.id);
        const newItems = validChecklist.filter(item => !item.id);

        let finalReqIds: number[] =[...existingItems.map(i => i.id as number)];

        if (newItems.length > 0) {
            const inserts = newItems.map(item => ({
                name: item.text,
                type: item.reqType
            }));

            const { data: insertedReqs, error: insertErr } = await supabase
                .from('prework_default_reqs')
                .insert(inserts)
                .select('id');

            if (insertErr) throw insertErr;
            if (insertedReqs) {
                finalReqIds =[...finalReqIds, ...insertedReqs.map(r => r.id)];
            }
        }

        await supabase
            .from('prework_bridge_table')
            .delete()
            .eq('prework_id', preworkId);

        if (finalReqIds.length > 0) {
            const bridgeInserts = finalReqIds.map(reqId => ({
                prework_id: preworkId,
                req_id: reqId
            }));

            const { error: bridgeErr } = await supabase
                .from('prework_bridge_table')
                .insert(bridgeInserts);

            if (bridgeErr) throw bridgeErr;
        }
        const uploadedUrls = await uploadFiles(preworkId, newFiles);
        if (uploadedUrls.length > 0) {
            await saveFileRecords('prework', preworkId, uploadedUrls);
        }

        showConfirmModal = false;
        dispatch("next"); // tell parent to switch phase

    } catch (err) {
        console.error("Failed to save workflow stage:", err);
        alert("Failed to save. Please check pre-existing requirements.");
    } finally {
        isSaving = false;
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
        newFiles = [...newFiles, ...Array.from(input.files)];
    }
}

async function handleDelete(index: number) {
    const url = existingFiles[index];

    await deleteFile('prework', preworkId, url);

    existingFiles = existingFiles.filter((_, i) => i !== index);
}

function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files) {
        newFiles = [...newFiles, ...Array.from(event.dataTransfer.files)];
    }
}

function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files){
        newFiles = [...newFiles, ...Array.from(event.dataTransfer.files)];
    }
}

function removeNewFile(index: number) {
    newFiles = newFiles.filter((_, i) => i !== index);
}

</script>

<div class="phase-container">
	<!-- CHECKLIST -->
	<div class="checklist-section">
		<h3>Set Default Requirements</h3>

		<div class="checklist-items">
			{#each checklist as item, i}
				<div class="checklist-row" transition:fly={{ x: -20, duration: 200 }}>
                    {#if item.id}
                        <!-- Existing Database Requirement -->
                        <div class="editable-text readonly-text">{item.text}</div>
                        <span class="type-badge">{item.reqType}</span>
                    {:else}
                        <input
                            class="editable-text"
                            type="text"
                            bind:value={item.text}
                            placeholder="Enter requirement name..."
                        />
                        <select class="type-dropdown" bind:value={item.reqType}>
                            <option value="String">String</option>
                            <option value="Date">Date</option>
                            <option value="Int">Int</option>
                        </select>
                    {/if}

					<button class="delete-btn" onclick={() => removeField(i)}>
						×
					</button>
				</div>
			{/each}
		</div>

        <!-- ADD FIELD CONTROLS -->
		<div class="add-controls">
            <div class="existing-adder">
                <select class="existing-dropdown" bind:value={selectedExistingId}>
                    <option value="" disabled selected>Add existing field...</option>
                    {#each availableReqs as req}
                        <option value={req.id}>{req.name} ({req.type})</option>
                    {/each}
                </select>
                <button class="add-existing-btn" onclick={addExistingField}>Add</button>
            </div>
			<button class="add-button-field" onclick={addNewField}>+ Add Custom Field</button>
		</div>
	</div>

	<!-- FILE UPLOAD -->
	<div class="upload-section">
		<div class="upload-header">
			<h3>Add Default Files</h3>
		</div>
        <input type="file" multiple class="hidden-file-input" onchange={handleFileSelect} />
        <div class="drop-zone" role="button" tabindex="0" ondrop={handleDrop} ondragover={handleDragOver}
            onclick={() => (document.querySelector('.hidden-file-input') as HTMLInputElement)?.click()}
            onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    (document.querySelector('.hidden-file-input') as HTMLInputElement)?.click();
                }}}>
                <p> 
                    <button type="button" class="blue-text"
                    onclick={(e) => {e.stopPropagation(); (document.querySelector('.hidden-file-input') as HTMLInputElement)?.click();}}> Choose file </button> 
                    to upload </p>
                </div>

                <!-- EXISTING FILES FROM DB -->
                 {#each existingFiles as url, i}
                 <div class="file-item">
        <a href={url} target="_blank">{url.split('/').pop()}</a>
        <button onclick={() => handleDelete(i)}>×</button>
    </div>
                 {/each}
                
                <!-- NEW FILES (NOT YET SAVED) -->
                 {#each newFiles as file, i}
                 <div class="file-item">
        <a href={URL.createObjectURL(file)} target="_blank">{file.name}</a>
        <button onclick={() => newFiles = newFiles.filter((_, j) => j !== i)}>×</button>
    </div>

            {/each}
        </div>

	<div class="pagenav">
		<button class="next" onclick={() => showConfirmModal = true} disabled={isLoading}>
            Proceed to <br/> Review and Approval
        </button>
	</div>
</div>

<!-- CONFIRMATION MODAL POPUP -->
{#if showConfirmModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Confirmation</h3>
            <p>Are you sure you want to save these requirements and proceed to the Review and Approval phase?</p>
            
            <div class="modal-actions">
                <button class="cancel-button" onclick={() => showConfirmModal = false} disabled={isSaving}>
                    Cancel
                </button>
                <button class="import-button" onclick={handleNext} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Confirm & Proceed'}
                </button>
            </div>
        </div>
    </div>
{/if}

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
		gap: 15px;
		margin-bottom: 25px;
	}

	.checklist-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.editable-text {
		flex: 1;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 8px 10px;
		font-size: 0.95rem;
	}

    .readonly-text {
        background-color: #f9fafb;
        color: #4b5563;
        border-color: #d1d5db;
    }

    .type-badge {
        font-size: 0.75rem;
        background: #e5e7eb;
        color: #374151;
        padding: 4px 8px;
        border-radius: 12px;
        font-weight: bold;
        text-transform: uppercase;
    }

    .type-dropdown {
        border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 8px;
		font-size: 0.85rem;
        background: white;
        color: #374151;
    }

	.delete-btn {
		background: #f3f4f6;
		border: none;
		border-radius: 6px;
		padding: 6px 12px;
		cursor: pointer;
		font-weight: bold;
		color: #555;
	}

	.delete-btn:hover {
		background: #e5e7eb;
	}

	.add-controls {
		display: flex;
        flex-direction: column;
		gap: 15px;
	}

    .existing-adder {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .existing-dropdown {
        flex: 1;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
    }

    .add-existing-btn {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        padding: 10px 15px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
    }

    .add-existing-btn:hover {
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
		box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        align-self: flex-start;
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

    /* MODAL STYLES */
    .modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex; justify-content: center; align-items: center;
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

    .modal-content h3 { margin-top: 0; margin-bottom: 15px; color: #7a1a1a; }
    .modal-content p { color: #4b5563; margin-bottom: 25px; line-height: 1.5; }

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