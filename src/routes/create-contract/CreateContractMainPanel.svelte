<script lang="ts">
    import CreateContractPhase from "../../lib/CreateContractPhase.svelte";
    
    interface Props {
        contractData: any;
        currentPhase: string;
        onComplete?: () => void;
    }

    let { 
        contractData = $bindable(), 
        currentPhase = $bindable("Prework"),
        onComplete,
    }: Props = $props();
    
    let phases = [
        "Prework",
        "Review and Approval",
        "Signing and Activation",
        "Postwork"
    ];
</script>

<div class="phases-container">
    <div class="tab-bar">
        {#each phases as phase}
            <div
                class="tab"
                class:active={currentPhase === phase}
            >
                {phase}
            </div>
        {/each}
    </div>
    <div class="content-area">
        <CreateContractPhase
            phase={currentPhase}
            onPhaseChange={(p: string) => currentPhase = p}
            bind:contractData={contractData}
            {onComplete}
        />
    </div>
</div>

<style>
    .phases-container {
        border: 2px solid #e5e7eb;
        border-radius: 20px;
        overflow: hidden;
        background-color: #fff;
    }

    .tab-bar {
        flex: 1;
        display: flex;
        background-color: #f3f4f6;
        border-bottom: 2px solid #e5e7eb;
    }

    .tab {
        flex: 1;                  
        display: flex;            
        justify-content: center;   
        align-items: center;       
        padding: 15px 10px;
        background: transparent;
        font-size: 16px;
        font-weight: bold;
        color: #7a1a1a;
        cursor: default;
        border-right: 1px solid #e5e7eb;
        transition: all 0.2s;
    }

    .tab:last-child {
        border-right: none;
    }

    .tab.active {
        background-color: #7a1a1a; 
        color: white;
        cursor: default;
        box-shadow: inset 0 -4px 0 rgba(0,0,0,0.1);
    }

    .content-area {
        padding: 40px;
        min-height: 400px;
    }
    
    :global(.workflow-phase-root) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
    }
</style>