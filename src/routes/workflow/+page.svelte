<script lang="ts">
    import { page } from '$app/stores';
    import WorkflowMainPanel from "./WorkflowMainPanel.svelte";
    import { enhance } from '$app/forms';
    import { Pencil, Check, Plus, Trash2, ChevronDown } from 'lucide-svelte';

    let {data, form} = $props();
    let {access, workflows} = $derived(data);

    let selectedId = $derived($page.url.searchParams.get('selected'));
    let activeWorkflow = $state(
        (selectedId && workflows.find((w: any) => w.id === selectedId)) || workflows[0]
    );
    let activeWorkflowId = $derived(activeWorkflow?.id);
    let displayedWorkflowName = $state(activeWorkflow?.name || '');

    let isEditing = $state(false);
    let showAddInput = $state(false);
    let newWorkflowName = $state('');

    function startEditing() {
        isEditing = true;
    }

    function handleWorkflowChange() {
        displayedWorkflowName = activeWorkflow?.name || '';
        isEditing = false;
    }

    function toggleAddInput() {
        showAddInput = !showAddInput;
        if (showAddInput) {
            newWorkflowName = '';
        }
    }

    function handleAddSuccess() {
        showAddInput = false;
        newWorkflowName = '';
        window.location.reload();
    }

    function handleRemoveSuccess() {
        window.location.reload();
    }
</script>

{#if access !== "Workflow Manager"}
    <h1 style="text-align:center; margin-top: 4rem;">You do not have access to view this page. <br> Please contact a Workflow Manager.</h1>
{:else}
<div class="main-content">
    <div class="workflow-area">
        
        <div class="workflow-header">
            <div class="left-section">
                {#if isEditing}
                    <div class="edit-group">
                        <form method="POST" action="?/update_name" class="inline-form">
                            <input type="hidden" name="workflow_id" value={activeWorkflowId}/>
                            <input 
                                type="text" 
                                name="new_name"
                                bind:value={displayedWorkflowName} 
                                class="title-input"
                                autofocus
                            />
                            <button class="action-btn save-btn">
                                <Check size={16} strokeWidth={3} />
                            </button>
                        </form>
                    </div>
                {:else}
                    <div class="view-group">
                        <h1 class="page-title">{displayedWorkflowName}</h1>
                        <button class="action-btn rename-btn" onclick={startEditing}>
                            <Pencil size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                {/if}
            </div>

            <div class="right-section">
                <span class="workflow-label">Select Workflow:</span>
                <div class="select-wrapper">
                    <select
                        class="workflow-select"
                        bind:value={activeWorkflow}
                        onchange={handleWorkflowChange}
                    >
                        {#each workflows as w}
                            <option value={w}>{w.name}</option>
                        {/each}
                    </select>
                    <ChevronDown size={16} class="wf-chevron" />
                </div>

                {#if showAddInput}
                    <form method="POST" action="?/add_workflow" use:enhance={() => {
                        return async ({ result }) => {
                            if (result.type === 'success') {
                                handleAddSuccess();
                            }
                        };
                    }}>
                        <input
                            type="text"
                            name="new_name"
                            bind:value={newWorkflowName}
                            placeholder="Workflow name"
                            class="workflow-name-input"
                        />
                        <button type="submit" class="action-btn add-confirm-btn" title="Confirm Add">
                            <Check size={16} strokeWidth={3} />
                        </button>
                    </form>
                {:else}
                    <button class="action-btn add-btn" onclick={toggleAddInput} title="Add Workflow">
                        <Plus size={16} strokeWidth={2.5} />
                        <span>Add Workflow</span>
                    </button>
                {/if}

                {#if workflows.length > 1 && activeWorkflowId}
                    <form method="POST" action="?/remove_workflow" use:enhance={() => {
                        return async ({ result }) => {
                            if (result.type === 'success') {
                                handleRemoveSuccess();
                            }
                        };
                    }}>
                        <input type="hidden" name="workflow_id" value={activeWorkflowId} />
                        <button type="submit" class="action-btn remove-btn" title="Remove Workflow" onclick={(e) => {
                            if (!confirm('Are you sure you want to remove this workflow?')) {
                                e.preventDefault();
                            }
                        }}>
                            <Trash2 size={16} strokeWidth={2.5} />
                            <span>Delete Workflow</span>
                        </button>
                    </form>
                {/if}
            </div>
        </div>
    
        <WorkflowMainPanel workflow={activeWorkflow} />
    </div>
</div>
{/if}

<style>
    .main-content {
        display: block; 
        max-width: 1400px;
        margin: 2rem auto;
        padding: 0 1.5rem;
        width: 100%;
        box-sizing: border-box;
    }

    .workflow-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 3rem;
        margin-bottom: 1.5rem;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .right-section {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .workflow-label {
        font-family: 'Poppins', sans-serif;
        font-size: 1.1rem;
        font-weight: 700;
        color: #02461C;
        margin-right: 0.75rem;
    }

    .select-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .workflow-select {
        font-family: 'Poppins', sans-serif;
        font-size: 0.95rem;
        padding: 0.5rem 32px 0.5rem 0.5rem;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        color: rgb(68, 68, 68);
        background-color: white;
        outline: none;
        cursor: pointer;
        font-weight: 600;
        transition: border-color 0.2s;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        
        width: 240px; 
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }

    :global(.wf-chevron) {
        position: absolute;
        right: 10px;
        pointer-events: none;
        color: #6b7280;
        flex-shrink: 0;
    }

    .workflow-select:focus, .workflow-select:hover {
        border-color: #7B1113;
    }

    .inline-form {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        margin: 0;
    }

    .view-group, .edit-group {
        display: flex;
        align-items: center;
        gap: 1.5rem;
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
        min-width: 450px;
        box-sizing: border-box;
    }

    @media (max-width: 768px) {
        .main-content { padding: 0 1rem; margin: 1rem auto; }
        .page-title { font-size: 1.5rem; }
        .title-input { min-width: 0; width: 100%; }
        .workflow-select { width: 100%; }
        .workflow-label { display: none; }
        .left-section, .right-section { width: 100%; }
    }

    @media (max-width: 480px) {
        .page-title { font-size: 1.25rem; }
        .workflow-header { flex-direction: column; align-items: flex-start; }
    }

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

    .add-btn {
        background-color: #035a24;
        padding: 8px;
        margin: 10px;
    }
    .add-btn:hover {
        background-color: #02451C;
    }

    .remove-btn {
        background-color: #7B1113;
        padding: 8px;
    }
    .remove-btn:hover {
        background-color: #5a0c0e;
    }

    .add-confirm-btn {
        background-color: #035a24;
        padding: 8px;
        margin: 10px;
    }
    .add-confirm-btn:hover {
        background-color: #02451C;
    }

    .workflow-name-input {
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        padding: 8px 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        color: rgb(68, 68, 68);
        outline: none;
        font-weight: 600;
        width: 180px;
        margin-left: 0.5rem;
    }

    .workflow-name-input:focus {
        border-color: #7B1113;
    }

    .right-section form {
        display: flex;
        align-items: center;
        margin: 0;
    }
</style>