<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Prework from "$lib/phases_workflow/Prework.svelte";
    import ReviewApproval from "$lib/phases_workflow/ReviewApproval.svelte";
    import SigningActivation from "$lib/phases_workflow/SigningActivation.svelte";
    import Postwork from "$lib/phases_workflow/Postwork.svelte";

    interface Props {
        phase: string;
        onPhaseChange: (newPhase: string) => void; 
        preworkId?: any; 
        approvalId?: any;
        activationId?: any;
        postworkId?: any;
    }

    let {
        phase,
        onPhaseChange,
        preworkId,
        approvalId,
        activationId,
        postworkId
    }: Props = $props(); 


    function changePhase(newPhase: string) {
    onPhaseChange(newPhase); 
    }
</script>

<div class="phase">
    {#if phase === "Prework"}
     {#key preworkId} 
        <Prework {preworkId} 
        on:next={() => changePhase("Review and Approval")} 
        />
     {/key}
    {:else if phase === "Review and Approval"}
        <ReviewApproval
        {approvalId}
        on:back={() => changePhase("Prework")} 
        on:next={() => changePhase("Signing and Activation")}
        />
    {:else if phase === "Signing and Activation"}
        <SigningActivation 
        {activationId}
        on:back={() => changePhase("Review and Approval")} 
        on:next={() => changePhase("Postwork")}
        />
    {:else if phase === "Postwork"}
        <Postwork 
        {postworkId}
        on:back={() => changePhase("Signing and Activation")} 
        />
    {/if}
</div>

<style>
    .phase {
        /*padding: 1rem;*/
    }
    .debug-box {
        /*outline: 5px solid orange;*/
    }
</style>
