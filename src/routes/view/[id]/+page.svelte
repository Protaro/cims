<script lang="ts">
    import { supabase } from "$lib/supabaseInit";
    import { goto, invalidateAll } from '$app/navigation';

    let { data } = $props();
    let users = $derived(data.users);
    let session_id = $derived(data.session_id);
    let contract = $derived(data.contract);
    let prework = $derived(data.prework || []);
    let approvals = $derived(data.approvals || { stages: [] });
    let activations = $derived(data.activations || []);
    let postwork = $derived(data.postwork || { milestones: [], termination: { type: "", reason: "" } });

    const editors = $derived(contract?.editors ?? []);
    const viewers = $derived(contract?.viewers ?? []);

    const editorUsers = $derived(
        users.filter(u => editors.includes(u.id))
    );

    const viewerUsers = $derived(
        users.filter(u => viewers.includes(u.id))
    );
    
    const isEditor = $derived(
        editorUsers.some(u => u.id === session_id)
    );

    const isViewer = $derived(
        viewerUsers.some(u => u.id === session_id)
    );

    let showDeleteModal = $state(false);
    let isDeleting = $state(false);

    async function confirmDelete() {
        if (!contract?.id) return;
        isDeleting = true;
        try {
            const { error } = await supabase
                .from('contracts')
                .delete()
                .eq('id', contract.id);

            if (error) throw error;
            goto('/view');
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete contract.");
        } finally {
            isDeleting = false;
        }
    }


</script>

{#if !isEditor && !isViewer}
    <p>You are not an editor or viewer for this contract.</p>
{:else}

<div class="main-content">
    <div class="header">
        <div class="title-group">
            <h1 class="page-title">{contract.title}</h1>
            <span class="status-badge" 
                  class:active={contract.status === 'Active'}
                  class:completed={contract.status === 'Completed'}
                  class:onhold={contract.status === 'On Hold'}
                  class:terminated={contract.status === 'Terminated'}>
                {contract.status}
            </span>
        </div>
        <div class="action-buttons">
            <a href="/edit-contract/{contract.id}" class="btn-cancel"> Edit </a>
            <button class="btn-danger" onclick={() => showDeleteModal = true}>Delete</button>
            <a href="/view" class="btn-cancel"> Back </a>
        </div>
    </div>

    <div class="info-card">
        <h2>General Information</h2>
        <div class="details-grid">
            <div class="detail-item">
                <span class="detail-label">Type</span>
                <span class="detail-value">{contract.type}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Created On</span>
                <span class="detail-value">{new Date(contract.created_at).toLocaleDateString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Last Modified On</span>
                <span class="detail-value">{new Date(contract.last_modified).toLocaleDateString()}</span>
            </div>
        </div>
    </div>

    <div class="info-card">
        <h2>Prework Details</h2>
        <div class="details-grid">
            {#if prework && prework.length > 0}
                {#each prework as item}
                    <div class="detail-item">
                        <span class="detail-label">{item.text}</span>
                        <span class="detail-value">{item.details}</span>
                    </div>
                {/each}
            {:else}
                <p class="empty-state">No prework details found.</p>
            {/if}
        </div>
    </div>

    <div class="info-card">
        <h2>Review and Approval Details</h2>
        {#if approvals.stages && approvals.stages.length > 0}
            <div class="stages-container">
                {#each approvals.stages as stage}
                    <div class="stage-block">
                        <h3 class="stage-title">{stage.name}</h3>
                        <ul class="static-checklist">
                            {#each stage.items as item}
                                <li>
                                    <input type="checkbox" checked={item.done} disabled />
                                    <span>{item.text}</span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </div>
        {:else}
            <p class="empty-state">No review and approval details found.</p>
        {/if}
    </div>

    <div class="info-card">
        <h2>Signing and Activation Details</h2>
        {#if activations && activations.length > 0}
            <div class="signing-list-container">
                {#each activations as party}
                    <div class="signing-item">
                        <span class="party-name">{party.name}</span>
                        {#if party.done}
                            <span class="sign-tag signed">SIGNED</span>
                        {:else}
                            <span class="sign-tag unsigned">UNSIGNED</span>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <p class="empty-state">No signing details found.</p>
        {/if}
    </div>

    <div class="info-card">
        <h2>Postwork Details</h2>
        
        <h3 class="stage-title">Milestones</h3>
        {#if postwork.milestones && postwork.milestones.length > 0}
            <ul class="static-checklist">
                {#each postwork.milestones as item}
                    <li>
                        <input type="checkbox" checked={item.done} disabled />
                        <span>{item.text}</span>
                    </li>
                {/each}
            </ul>
        {:else}
            <p class="empty-state">No milestones found.</p>
        {/if}

        {#if postwork.termination && (postwork.termination.type !== "" || postwork.termination.reason !== "")}
            <div style="margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1.5rem;">
                <h3 class="stage-title" style="color: #d93025;">Termination Details</h3>
                <div class="details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Type</span>
                        <span class="detail-value">{postwork.termination.type || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Reason</span>
                        <span class="detail-value">{postwork.termination.reason || 'N/A'}</span>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Delete Contract</h3>
            <p>
                Are you sure you want to delete <strong>"{contract?.title}"</strong>?
                <br/>This action cannot be undone.
            </p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick={() => showDeleteModal = false} disabled={isDeleting}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            </div>
        </div>
    </div>
{/if}
{/if}

<style>
    :global(body) {
        font-family: 'Poppins', sans-serif;
        background-color: #f9f9f9; 
    }
    
    .main-content {
        padding: 2rem;
        max-width: 900px;
        margin: 0 auto;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        border-bottom: 2px solid #eee;
        padding-bottom: 1rem;
    }

    .title-group {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .page-title { 
        font-size: 2rem; 
        font-weight: 700; 
        color: #02461C; 
        margin: 0; 
    }
    

    .status-badge {
        padding: 8px 14px;
        font-size: 1rem; 
        border-radius: 8px;
        font-weight: 600;
        background-color: #eee;
        color: #333;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .status-badge.active { background-color: #e6f4ea; color: #1e8e3e; }
    .status-badge.completed { background-color: #e8f0fe; color: #1a73e8; }
    .status-badge.onhold { background-color: #fef7e0; color: #f57c00; }
    .status-badge.terminated { background-color: #fadbd8; color: #d93025; }

    .action-buttons {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .info-card {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        margin-bottom: 2rem;
    }

    .info-card h2 {
        font-size: 1.2rem;
        color: #333;
        margin-top: 0;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid #eee;
        padding-bottom: 0.5rem;
    }

    .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .detail-label {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #666;
        font-weight: 600;
    }

    .detail-value {
        font-size: 1.05rem;
        color: #111;
        font-weight: 500;
    }

    .empty-state {
        color: #888;
        font-style: italic;
    }

    .btn-cancel {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #f0f0f0;
        color: black;
        padding: 8px 14px; 
        font-size: 1rem;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        transition: background 0.2s, color 0.2s;
    }

    .btn-cancel:hover {
        background: #e4e4e4;
    }

    .stages-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .stage-block {
        background-color: #fdfdfd;
        border: 1px solid #eee;
        padding: 1rem;
        border-radius: 8px;
    }

    .stage-title {
        margin: 0 0 0.75rem 0;
        font-size: 1rem;
        color: #02461C;
    }

    .static-checklist {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .static-checklist li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1rem;
        color: #444;
    }

    .static-checklist input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: not-allowed;
    }

    .signing-list-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .signing-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background-color: #fafafa;
        border: 1px solid #eee;
        border-radius: 6px;
    }

    .party-name {
        font-size: 1rem;
        font-weight: 500;
        color: #222;
    }

    .sign-tag {
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.5px;
    }

    .sign-tag.signed {
        color: #1e8e3e; /* Green */
    }

    .sign-tag.unsigned {
        color: #d93025; /* Red */
    }

    .btn-danger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #dc2626;
        color: white;
        padding: 8px 14px;
        font-size: 1rem;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        border: none;
        cursor: pointer;
        font-family: 'Poppins', sans-serif;
        transition: background 0.2s;
    }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }
    .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

    .modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        z-index: 1000;
    }
    .modal-content {
        background: white; padding: 30px; border-radius: 12px;
        width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        text-align: center;
    }
    .modal-content h3 { margin-top: 0; color: #111827; }
    .modal-content p { font-size: 0.95rem; color: #4b5563; margin-bottom: 25px; line-height: 1.5; }
    .modal-actions { display: flex; justify-content: center; gap: 15px; }
</style>