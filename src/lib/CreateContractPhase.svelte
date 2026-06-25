<script lang="ts">
    import Prework from "$lib/phases_contract/Prework.svelte";
    import ReviewApproval from "$lib/phases_contract/ReviewApproval.svelte";
    import SigningActivation from "$lib/phases_contract/SigningActivation.svelte";
    import Postwork from "$lib/phases_contract/Postwork.svelte";

    interface Props {
        phase: string;
        onPhaseChange: (p: string) => void;
        contractData: any;
        onComplete?: () => void;
    }

    let { 
        phase, 
        onPhaseChange, 
        contractData = $bindable(),
        onComplete,
    }: Props = $props();

    function changePhase(p: string) {
        onPhaseChange(p);
    }
</script>

<div class="phase">
    {#if phase === "Prework"}

        <Prework
            bind:data={contractData.prework}
            stageId={contractData.id}
            on:next={() => changePhase("Review and Approval")}
        />
    {:else if phase === "Review and Approval"}

        <ReviewApproval
            bind:data={contractData.approval}
            stageId={contractData.id}
            on:back={() => changePhase("Prework")}
            on:next={() => changePhase("Signing and Activation")}
        />
    {:else if phase === "Signing and Activation"}

        <SigningActivation
            bind:data={contractData.activation}
            stageId={contractData.id}
            on:back={() => changePhase("Review and Approval")}
            on:next={() => changePhase("Postwork")}
        />
    {:else if phase === "Postwork"}

        <Postwork
            bind:data={contractData.postwork}
            on:back={() => changePhase("Signing and Activation")}
            {onComplete}
        />

    {/if}

</div>

<style>
.phase {
    padding: 1rem;
}
</style>
