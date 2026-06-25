<script lang="ts">
	import { fly } from 'svelte/transition';
	import { createEventDispatcher } from "svelte";
	import { supabase } from "$lib/supabaseInit";

	let { activationId } = $props();

	type Party = { name: string; done: boolean };

	let parties: Party[] = $state([]);
	let isSaving = $state(false);
	let isLoading = $state(true);
	let showConfirmModal = $state(false);

	const dispatch = createEventDispatcher();

	$effect(() => {
		if (activationId) {
			loadParties(activationId);
		} else {
			isLoading = false;
			parties = [
				{ name: "Party 1", done: false },
				{ name: "Party 2", done: false }
			];
		}

		loadParties(activationId);
	});

	async function loadParties(currentId: string) {
		isLoading = true;
		const { data, error } = await supabase
			.from('activations')
			.select('parties')
			.eq('id', currentId)
			.single();

		if (error) {
			console.error("Error fetching activation data:", error);
			parties = [{ name: "Party 1", done: false }, { name: "Party 2", done: false }];
		} else if (data && data.parties && data.parties.length > 0) {
			parties = data.parties as Party[];
		} else {
			parties = [{ name: "Party 1", done: false }, { name: "Party 2", done: false }];
		}
		isLoading = false;
	}

	function addParty() {
		parties.push({ name: "New Party", done: false });
	}

	function removeParty(index: number) {
		parties.splice(index, 1);
	}

	function handleBack() {
		dispatch("back");
	}

	async function saveAndNext() {
		if (isSaving) return;
		isSaving = true;
		if (!activationId) {
			alert("Missing Activation ID. Cannot save.");
			showConfirmModal = false;
			return;
		}

		try {
			const validParties = parties.filter(p => p.name.trim() !== "");
			
			const pureJsonParties = JSON.parse(JSON.stringify(validParties));

			const { error } = await supabase
				.from('activations')
				.update({ parties: pureJsonParties })
				.eq('id', activationId);

			if (error) throw error;

			showConfirmModal = false;
			dispatch("next");

		} catch (err) {
			console.error("Failed to save activation stage:", err);
			alert("Failed to save. Please try again.");
		} finally {
			isSaving = false;
		}
	}

</script>

<div class="phase-container">
	<!-- PARTIES SECTION -->
	<div class="checklist-section">
		<h3>Signing & Activation - Required Parties</h3>

		{#if isLoading}
			<p>Loading parties...</p>
		{:else}
			<div class="checklist-items">
				{#each parties as party, i}
					<div class="checklist-row" transition:fly={{ x: -20, duration: 200 }}>
						<label class="custom-checkbox">
							<input type="checkbox" bind:checked={party.done} />
							<span class="checkmark"></span>
						</label>

						<input
							class="editable-text"
							type="text"
							bind:value={party.name}
							placeholder="Enter party name (e.g. Legal, Client...)"
						/>

						<button class="delete-btn" onclick={() => removeParty(i)}>
							×
						</button>
					</div>
				{/each}
			</div>

			<button class="add-button-field" onclick={addParty}>
				+ Add Party
			</button>
		{/if}
	</div>

	<!-- FOOTER NAVIGATION -->
	<div class="pagenav">
		<button class="back" onclick={handleBack} disabled={isLoading || isSaving}>
			Return to <br/> Review and Approval
		</button>
		<button class="next" onclick={() => showConfirmModal = true} disabled={isLoading || isSaving}>
			Proceed to <br> Postwork
		</button>
	</div>
</div>

<!-- CONFIRMATION MODAL POPUP -->
{#if showConfirmModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Confirmation</h3>
            <p>Are you sure you want to save these parties and proceed to the final Postwork phase?</p>
            
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

	.checklist-items {
		display: flex;
		flex-direction: column;
		gap: 15px;
		margin-bottom: 10px;
	}

	.checklist-row {
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
		cursor: pointer;
		flex-shrink: 0;
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
		font-size: 0.95rem;
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

	.cancel-button { background: white; border: 1px solid #e5e7eb; padding: 10px 30px; border-radius: 8px; cursor: pointer; }
	.import-button { background: #3b00ff; color: white; border: none; padding: 10px 35px; border-radius: 8px; font-weight: bold; cursor: pointer; }

	.next, .back {
		background: transparent; border: 2px solid;
		padding: 12px 40px; border-radius: 9999px; font-weight: bold;
		cursor: pointer; transition: background-color 0.2s ease, color 0.2s ease, transform 0.1s ease;
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

	.pagenav { grid-column: 1 / -1; display: flex; justify-content: space-between; margin-top: 30px; }

	.next:hover { background-color: #3b00ff; color: white; }
	.back:hover:not(:disabled) { background-color: #7a1a1a; color: white; }
	.next:active, .back:active:not(:disabled) { transform: scale(0.97); }
    .next:disabled, .back:disabled { opacity: 0.5; cursor: not-allowed; }

    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .modal-content {
        background: white; padding: 30px; border-radius: 12px; width: 400px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center;
    }
    .modal-content h3 { margin-top: 0; margin-bottom: 15px; color: #7a1a1a; }
    .modal-content p { color: #4b5563; margin-bottom: 25px; line-height: 1.5; }
    .modal-actions { display: flex; justify-content: center; gap: 15px; }

</style>