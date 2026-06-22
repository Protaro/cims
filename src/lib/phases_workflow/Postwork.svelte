<script lang="ts">
	import { fly } from 'svelte/transition';
	import { createEventDispatcher } from "svelte";
	import { supabase } from "$lib/supabaseInit";

	let { postworkId } = $props();

	type Milestone = { text: string; done: boolean };

	let milestones: Milestone[] = $state([]);
	let terminationType = $state("");
	let reason = $state("");

	let isSaving = $state(false);
	let isLoading = $state(true);
	let showConfirmModal = $state(false);

	const dispatch = createEventDispatcher();

	$effect(() => {
		if (postworkId) {
			loadPostwork(postworkId);
		} else {
			// default state if no ID exists
			isLoading = false;
			milestones = [
				{ text: "Milestone 1", done: false },
				{ text: "Milestone 2", done: false },
				{ text: "Milestone 3", done: false }
			];
		}
	});

	async function loadPostwork(currentId: string) {
		isLoading = true;
		const { data, error } = await supabase
			.from('postworks')
			.select('checklist')
			.eq('id', currentId)
			.single();

		if (error) {
			console.error("Error fetching postwork data:", error);
			//  defaults
			milestones = [{ text: "Milestone 1", done: false }];
		} else if (data && data.checklist) {
			const savedData = data.checklist as any;
			milestones = savedData.milestones || [];
			terminationType = savedData.termination?.type || "";
			reason = savedData.termination?.reason || "";
		}
		isLoading = false;
	}

	function addMilestone() {
		milestones.push({ text: "New Milestone", done: false });
	}

	function removeMilestone(index: number) {
		milestones.splice(index, 1);
	}

	function handleBack() {
		dispatch("back");
	}

	async function savePostwork() {
		if (!postworkId) {
			alert("Missing Postwork ID. Cannot save.");
			showConfirmModal = false;
			return;
		}

		isSaving = true;

		try {
			const payload = {
				milestones: JSON.parse(JSON.stringify(milestones)),
				termination: {
					type: terminationType,
					reason: reason
				}
			};

			const { error } = await supabase
				.from('postworks')
				.update({ checklist: payload })
				.eq('id', postworkId);

			if (error) throw error;

			alert("Workflow Finalized and Saved!");
			showConfirmModal = false;
		} catch (err) {
			console.error("Failed to save postwork:", err);
			alert("Failed to save changes.");
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="phase-container">
	{#if isLoading}
		<p>Loading final phase data...</p>
	{:else}
		<!-- OUTPUT MILESTONES -->
		<div class="section-card">
			<h3>Output Milestones</h3>

			<div class="checklist-items">
				{#each milestones as m, i}
					<div class="milestone-row" transition:fly={{ x: -20, duration: 200 }}>
						<label class="custom-checkbox">
							<input type="checkbox" bind:checked={m.done} />
							<span class="checkmark"></span>
						</label>
						<input 
							type="text" 
							class="editable-text" 
							bind:value={m.text} 
							placeholder="Milestone description..."
						/>
						<button class="delete-btn" onclick={() => removeMilestone(i)}>×</button>
					</div>
				{/each}
			</div>

			<button class="pill-button" onclick={addMilestone}>+ Add Milestone</button>
		</div>

		<!-- CONTRACT TERMINATION -->
		<div class="section-card termination-area">
			<h3>Terminate Contract</h3>

			<div class="form-group">
				<label for="term-type">Nature of Termination</label>
				<select id="term-type" bind:value={terminationType}>
					<option value="">Select type...</option>
					<option value="Immediate">Immediate</option>
					<option value="With Notice">With Notice</option>
				</select>
			</div>

			<div class="form-group">
				<label for="reason">Termination Reasoning</label>
				<textarea
					id="reason"
					rows="5"
					placeholder="Add Reasoning For Termination..."
					bind:value={reason}
				></textarea>
			</div>

			</div>
	{/if}

	<div class="pagenav">
		<button class="back" onclick={handleBack} disabled={isLoading || isSaving}>
			Return to <br/> Signing and Activation
		</button>
		<button class="next" onclick={() => showConfirmModal = true} disabled={isLoading || isSaving}>
			Save & <br/> Confirm
		</button>
	</div>
</div>

<!-- CONFIRMATION MODAL -->
{#if showConfirmModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Final Confirmation</h3>
            <p>Are you sure you want to save these milestones and termination details?</p>
            
            <div class="modal-actions">
                <button class="cancel-button" onclick={() => showConfirmModal = false} disabled={isSaving}>
                    Cancel
                </button>
                <button class="import-button" onclick={savePostwork} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Confirm & Save'}
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

	.section-card {
		display: flex;
		flex-direction: column;
		padding: 28px;
		border: 1px solid #e5e7eb;
		border-radius: 16px;
		background: white;
		box-shadow: 0 2px 4px rgba(0,0,0,0.02);
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

	.milestone-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.custom-checkbox input { display: none; }

	.checkmark {
		height: 20px; width: 20px;
		border: 2px solid #333;
		border-radius: 4px;
		position: relative;
		flex-shrink: 0;
		cursor: pointer;
		display: inline-block;
	}

	.custom-checkbox input:checked + .checkmark { background-color: #333; }
	.custom-checkbox input:checked + .checkmark:after {
		content: ""; position: absolute;
		left: 6px; top: 2px; width: 5px; height: 10px;
		border: solid white; border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.editable-text {
		flex: 1;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 0.9rem;
	}

	.delete-btn {
		background: #f3f4f6;
		border: none;
		border-radius: 6px;
		padding: 4px 10px;
		cursor: pointer;
		color: #999;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 18px;
	}

	.form-group label {
		font-size: 0.85rem;
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

	.pill-button:hover:not(:disabled) { background-color: #5a1313; }

	.back {
		background: transparent;
		color: #7a1a1a;
		border: 2px solid #7a1a1a;
		padding: 12px 40px;
		border-radius: 9999px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease;
	}

	.back:hover:not(:disabled) {
		background-color: #7a1a1a;
		color: white;
	}

	.pagenav {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		margin-top: 30px;
	}

	.next {
		background: transparent;
		color: #035a24;
		border: 2px solid #035a24;
		padding: 12px 40px;
		border-radius: 9999px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease;
	}

	.next:hover {
		background-color: #035a24;
		color: white;
	}

	.next:active {
		transform: scale(0.97);
	}

	.next:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

    /* MODAL STYLES */
    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .modal-content {
        background: white; padding: 30px; border-radius: 12px; width: 400px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center;
    }
    .modal-actions { display: flex; justify-content: center; gap: 15px; margin-top: 20px; }
    .cancel-button { background: white; border: 1px solid #e5e7eb; padding: 10px 25px; border-radius: 8px; cursor: pointer; }
    .import-button { background: #3b00ff; color: white; border: none; padding: 10px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; }
</style>