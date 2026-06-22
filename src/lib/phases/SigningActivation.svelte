<script lang="ts">
    let checklist = {
		"items": ["UPSE", "DCS", "OSPA", "Malacanang"]
	}
    let notes = "";

</script>

<div class="phase-container">
	<!-- CHECKLIST -->
	<div class="checklist-section">
		<h3>Checklist</h3>
		<div class="checklist-items">
			{#each checklist.items as item}
				<div>
					{item}
					<button class="pill-button">this be a delete button</button>
				</div>
			{/each}
		</div>
		<h3>Add new signatory</h3>
		<div class="url-input-container">
			<input type="text" placeholder="Party Name"/>
			<button class="pill-button">Add Signatory</button>
		</div>
	</div>
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
		font-size: 1.2rem;
		margin-bottom: 25px;
		font-weight: bold;
		color: #000;
	}

	.checklist-items {
		display: flex;
		flex-direction: column;
		gap: 15px;
		margin-bottom: 30px;
	}

	.custom-checkbox {
		display: flex;
		align-items: center;
		cursor: pointer;
		font-size: 1rem;
		color: #374151;
		user-select: none;
	}

	.custom-checkbox input {
		display: none; 
	}

	.checkmark {
		height: 22px;
		width: 22px;
		border: 2px solid #333;
		border-radius: 4px;
		margin-right: 15px;
		display: inline-block;
		position: relative;
		flex-shrink: 0;
	}

	.custom-checkbox input:checked + .checkmark {
		background-color: #333;
	}

	.custom-checkbox input:checked + .checkmark:after {
		content: "";
		position: absolute;
		left: 7px;
		top: 3px;
		width: 5px;
		height: 10px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.pill-button {
		background-color: #7a1a1a;
		color: white;
		border: none;
		padding: 10px 30px;
		border-radius: 50px;
		font-weight: bold;
		cursor: pointer;
		box-shadow: 0 4px 6px rgba(0,0,0,0.1);
		transition: background-color 0.2s;
	}

	.pill-button:hover {
		background-color: #5a1313;
	}

	.url-input-container {
		display: flex;
		background: transparent;
		border: none;
		border-radius: 8px;
		padding: 10px 15px;
		margin-bottom: 30px;
	}


</style>