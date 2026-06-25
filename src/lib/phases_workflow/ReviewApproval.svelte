<script lang="ts">
	import { fly } from 'svelte/transition';
	import { createEventDispatcher } from "svelte";
	import { supabase } from "$lib/supabaseInit";

	let { approvalId } = $props();

	type ApprovalItem = { text: string; done: boolean };
	type Stage = { name: string; items: ApprovalItem[] };

	let stages: Stage[] = $state([]);
	let isSaving = $state(false);
	let isLoading = $state(true);
	let showConfirmModal = $state(false);

	const dispatch = createEventDispatcher();

	$effect(() => {
		if (approvalId) {
			loadChecklist(approvalId);
		} else {
			isLoading = false;
			stages =[
				{
					name: "Approval Stage 1",
					items: [{ text: "Approval Item", done: false }]
				}
			];
			return;
		}

		loadChecklist(approvalId)
    });

	async function loadChecklist(currentId: string) {
		isLoading = true;

		const { data, error } = await supabase
			.from('approvals')
			.select('checklist')
			.eq('id', currentId)
			.single();

		if (error) {
			console.error("Error fetching approval data:", error);
            stages =[{ name: "Approval Stage 1", items: [{ text: "Approval Item", done: false }] }];
		} else if (data && data.checklist && data.checklist.length > 0) {
            // Only load from DB if NOT empty array
			stages = data.checklist as Stage[];
		} else {
            // If the DB returned null or [], use default starting canvas
			stages =[
				{
					name: "Approval Stage 1",
					items: [{ text: "Approval Item", done: false }]
				}
			];
		}
		
		isLoading = false;
	}

	function addStage() {
		stages.push({ name: "New Approval Stage", items:[] });
	}

	function removeStage(index: number) {
		stages.splice(index, 1);
	}

	function addItem(stageIndex: number) {
		stages[stageIndex].items.push({ text: "New Item", done: false });
	}

	function removeItem(stageIndex: number, itemIndex: number) {
		stages[stageIndex].items.splice(itemIndex, 1);
	}

	function handleBack() {
		dispatch("back");
	}

	async function saveAndNext() {
		if (isSaving) return;
		isSaving = true;
		
		if (!approvalId) {
			alert("Missing Approval ID. Cannot save.");
			showConfirmModal = false;
			isSaving = false;
			return;
		}
		
		try {
			// remove completely blank stages, and remove blank items inside valid stages
			const validStages = stages
				.filter(stage => stage.name.trim() !== "")
				.map(stage => ({
					name: stage.name,
					items: stage.items.filter(item => item.text.trim() !== "")
				}));

			// turn Svelte $state into JSON
			const pureJsonChecklist = JSON.parse(JSON.stringify(validStages));

			const { error } = await supabase
				.from('approvals')
				.update({ checklist: pureJsonChecklist }) 
				.eq('id', approvalId);

			if (error) throw error;

			showConfirmModal = false;
			dispatch("next");

		} catch (err) {
			console.error("Failed to save approval stage:", err);
			alert("Failed to save. Please try again.");
		} finally {
			isSaving = false;
		}
	}

</script>

<div class="phase-container">
	<div class="checklist-section">
		<h3>Default Approval Checklist</h3>

		{#if isLoading}
			<p>Loading approval checklist...</p>
		{:else}
			{#each stages as stage, si}
				<div class="stage-box" transition:fly={{ x: -20, duration: 200 }}>
					<div class="checklist-row">
						<input
							class="editable-text"
							type="text"
							bind:value={stage.name}
                            placeholder="Enter stage name..."
						/>
						<button class="delete-btn" onclick={() => removeStage(si)}>
							×
						</button>
					</div>

					<div class="nested-items">
						{#each stage.items as item, ii}
							<div class="checklist-row" transition:fly={{ x: -20, duration: 200 }}>
								<label class="custom-checkbox">
									<input type="checkbox" bind:checked={item.done} />
									<span class="checkmark"></span>
								</label>

								<input
									class="editable-text"
									type="text"
									bind:value={item.text}
                                    placeholder="Enter approval item..."
								/>

								<button class="delete-btn" onclick={() => removeItem(si, ii)}>
									×
								</button>
							</div>
						{/each}

						<button class="add-button-field" onclick={() => addItem(si)}>
						+ Add Approval Item
						</button>
					</div>
				</div>
			{/each}

			<button class="add-button-field" onclick={addStage}>
			+ Add Stage
			</button>
		{/if}
	</div>

	<div class="pagenav">
		<button class="back" onclick={handleBack} disabled={isLoading || isSaving}>
		Return to <br/> Prework
		</button>
		<button class="next" onclick={() => showConfirmModal = true} disabled={isLoading || isSaving}>
			Proceed to <br> Signing and Activation
		</button>
	</div>
</div>

<!-- CONFIRMATION MODAL POPUP -->
{#if showConfirmModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Confirmation</h3>
            <p>Are you sure you want to save these approval checks and proceed to Signing and Activation?</p>
            
            <div class="modal-actions">
                <button class="cancel-button" onclick={() => showConfirmModal = false} disabled={isSaving}>
                    Cancel
                </button>
                <button class="import-button" onclick={saveAndNext} disabled={isSaving}>
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

	.custom-checkbox input {
		display: none;
	}

	.checkmark {
		display: inline-block;
		height: 20px;
		width: 20px;
		border: 2px solid #333;
		border-radius: 4px;
		position: relative;
		cursor: pointer;
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
		flex: 0.14;
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

	.back:hover:not(:disabled) {
		background-color: #7a1a1a;
		color: white;
	}

	.next:active, .back:active:not(:disabled) {
		transform: scale(0.97);
	}
    
    .next:disabled, .back:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

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

</style>