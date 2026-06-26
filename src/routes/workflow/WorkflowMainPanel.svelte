<script lang="ts">
    import WorkflowPhase from "../../lib/WorkflowPhase.svelte";
    let { workflow }: { workflow: any } = $props();

    let activePhase = $state("Prework");
    let phases = ["Prework", "Review and Approval", "Signing and Activation", "Postwork"];

    let workflowId = $derived(workflow?.id);
    let preworkId = $derived(workflow?.prework);
    let approvalId = $derived(workflow?.approval);
    let activationId = $derived(workflow?.activation);
    let postworkId = $derived(workflow?.postwork);
</script>
<div class="phases-container">
    <div class="tab-bar">
        {#each phases as phase}
            <button
                class="tab"
                class:active={activePhase === phase}
                onclick={() => activePhase = phase}
                disabled={activePhase === phase}
            >
                {phase}
            </button>
        {/each}
    </div>

    {#if workflowId}
        <div class="content-area">
            <WorkflowPhase
                phase={activePhase}
                onPhaseChange={(newPhase) => activePhase = newPhase}
                preworkId={preworkId}
                approvalId={approvalId}
                activationId={activationId}
                postworkId={postworkId}
            />
        </div>
    {:else}
        <div class="content-area empty-state">
            <p>No workflow selected or available.</p>
        </div>
    {/if}
</div>

<style>
    .phases-container {
        border: 2px solid #dadce0;
        border-radius: 20px;
        overflow: hidden;
        background-color: #fff;
    }

    .tab {
        flex: 1;
        padding: 15px 20px;
        font-weight: 800;
        color: #7a1a1a; 
        text-align: center;
        border-right: 2px solid #dadce0;
        transition: background-color 0.3s ease, color 0.3s ease;
        background: transparent;
        border-top: none;
        border-left: none;
        border-bottom: none;
        cursor: pointer;
        font-family: inherit;
        font-size: 1.1rem;
    }
    .tab:disabled {
        cursor: default;
    }
    .tab:not(.active):hover {
        background-color: #e5e7eb;
    }
     .tab-bar {
        display: flex;
        font-size: 1.1rem;
        width: 100%;
        background-color: #f3f4f6;
        border-bottom: 2px solid #dadce0;
    }
    .tab:last-child {
        border-right: none;
    }
    .tab.active {
        background-color: #7a1a1a; 
        color: white;              
    }
    .content-area {
        padding: 15px 40px;
        min-height: 400px;
    }

    .content-area.empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        font-family: 'Poppins', sans-serif;
    }
    :global(.workflow-phase-root) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
    }
</style>