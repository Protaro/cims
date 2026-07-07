<script lang="ts">
import { invalidateAll } from '$app/navigation';
    import { supabase } from '$lib/supabaseInit';

let {
    contractIds,
    groups,
    editors,
    viewers
}: {
    contractIds: string[];
    groups: any[];
    editors: string[];
    viewers: string[];
} = $props();

let selectedEditorGroup = $state('');
let selectedViewerGroup = $state('');

const editorGroups = $derived(
    groups?.filter(g => editors?.includes(g.id)) ?? []
);

const viewerGroups = $derived(
    groups?.filter(g => viewers?.includes(g.id)) ?? []
);

const availableEditorGroups = $derived(
    groups?.filter(g => !editors?.includes(g.id)) ?? []
);

const availableViewerGroups = $derived(
    groups?.filter(g => !viewers?.includes(g.id)) ?? []
);

async function submitAction(action: string, groupId: string) {
    const body = new URLSearchParams();
    body.set('groupId', groupId);
    body.set('contractIds', JSON.stringify(contractIds));

    await fetch(`?/${action}`, {
        method: 'POST',
        body
    });

    selectedEditorGroup = '';
    selectedViewerGroup = '';
    await invalidateAll();
}

async function getNameById(id : string) {
    const { data : name} = await supabase
        .from('profiles')
        .select('username')
        .eq('id', id)
        .single()

    return name
}

</script>

<div class="columns-row">
    <div class="collab-column">
        <div class="add-form">
            <select class="select-input" bind:value={selectedEditorGroup}>
                <option value="">Add as Editor</option>
                {#each availableEditorGroups as group}
                    <option value={group.id}>{group.group_name}</option>
                {/each}
            </select>
            <button class="small-btn" disabled={!selectedEditorGroup} onclick={() => submitAction('addEditor', selectedEditorGroup)}>Add</button>
        </div>

        <h3>Editors</h3>
        <div class="collab-list">
            {#each editors as editor}
                {getNameById(editor)}
            {/each}
        </div>
    </div>

    <div class="collab-column">
        <div class="add-form">
            <select class="select-input" bind:value={selectedViewerGroup}>
                <option value="">Add as Viewer</option>
                {#each availableViewerGroups as group}
                    <option value={group.id}>{group.group_name}</option>
                {/each}
            </select>
            <button class="small-btn" disabled={!selectedViewerGroup} onclick={() => submitAction('addViewer', selectedViewerGroup)}>Add</button>
        </div>

        <h3>Viewers</h3>
        <div class="collab-list">
            {#each viewers as viewer}
                <div class="collab-item">
                    <span>{viewer}</span>
                    <button type="button" class="text-btn">Remove (not functional rn)</button>
                </div>
            {/each}
        </div>
    </div>
</div>

<!-- <div class="columns-row">
    <div class="collab-column">
        <div class="add-form">
            <select class="select-input" bind:value={selectedEditorGroup}>
                <option value="">Add as Editor</option>
                {#each availableEditorGroups as group}
                    <option value={group.id}>{group.group_name}</option>
                {/each}
            </select>
            <button class="small-btn" disabled={!selectedEditorGroup} onclick={() => submitAction('addEditor', selectedEditorGroup)}>Add</button>
        </div>

        <h3>Editors</h3>
        <div class="collab-list">
            {#each editorGroups as group}
                <div class="collab-item">
                    <span>{group.group_name}</span>
                    <button type="button" class="text-btn" onclick={() => submitAction('removeEditor', group.id)}>Remove</button>
                </div>
            {/each}
        </div>
    </div>

    <div class="collab-column">
        <div class="add-form">
            <select class="select-input" bind:value={selectedViewerGroup}>
                <option value="">Add as Viewer</option>
                {#each availableViewerGroups as group}
                    <option value={group.id}>{group.group_name}</option>
                {/each}
            </select>
            <button class="small-btn" disabled={!selectedViewerGroup} onclick={() => submitAction('addViewer', selectedViewerGroup)}>Add</button>
        </div>

        <h3>Viewers</h3>
        <div class="collab-list">
            {#each viewerGroups as group}
                <div class="collab-item">
                    <span>{group.group_name}</span>
                    <button type="button" class="text-btn" onclick={() => submitAction('removeViewer', group.id)}>Remove</button>
                </div>
            {/each}
        </div>
    </div>
</div> -->

<style>
.columns-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
}

.collab-column {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
}

.collab-column h3 {
    font-family: 'Poppins', sans-serif;
    font-size: 1.1rem;
    margin: 0;
    color: #374151;
}

.collab-list {
    display: flex;
    flex-direction: column;
}

.collab-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.9rem;
}

.collab-item:last-child {
    border-bottom: none;
}

.text-btn {
    background: none;
    border: none;
    color: #dc2626;
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
}

.add-form {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.select-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    font-family: 'Poppins', sans-serif;
    font-size: 0.9rem;
    background: white;
    outline: none;
    transition: border-color 0.2s ease;
}

.select-input:focus {
    border-color: #4b5563;
}

.small-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 12px;
    background: maroon;
    color: white;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    transition: background 0.2s ease, transform 0.15s ease;
    flex-shrink: 0;
}

.small-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.small-btn:disabled:hover {
    background: maroon;
    transform: none;
}

.small-btn:hover {
    background: #374151;
    transform: translateY(-1px);
}

.small-btn:active {
    transform: scale(0.96);
}
</style>
