<script lang="ts">

let {
    contractId,
    users,
    editors,
    viewers
}: {
    contractId: string;
    users: any[];
    editors: string[];
    viewers: string[];
} = $props();

const editorUsers = $derived(
    users?.filter(u => editors?.includes(u.id)) ?? []
);

const viewerUsers = $derived(
    users?.filter(u => viewers?.includes(u.id)) ?? []
);

const availableEditors = $derived(
    users?.filter(u => !editors?.includes(u.id)) ?? []
);

const availableViewers = $derived(
    users?.filter(u => !viewers?.includes(u.id)) ?? []
);

</script>

<div class="collaborators-panel">

    <div class="collab-column">

        <h3>Editors</h3>

        <div class="collab-list">
            {#each editorUsers as user}

                <div class="collab-item">

                    <span>{user.username}</span>

                    <form method="POST" action="?/removeEditor">

                        <input
                            type="hidden"
                            name="userId"
                            value={user.id}
                        />

                        <input
                            type="hidden"
                            name="contractId"
                            value={contractId}
                        />

                        <button
                            type="submit"
                            class="text-btn"
                        >
                            Remove
                        </button>

                    </form>

                </div>

            {/each}
        </div>

        <form
            method="POST"
            action="?/addEditor"
            class="add-form"
        >

            <input
                type="hidden"
                name="contractId"
                value={contractId}
            />

            <select
                name="userId"
                required
                class="select-input"
            >

                <option value="">
                    Add editor
                </option>

                {#each availableEditors as user}
                    <option value={user.id}>
                        {user.username}
                    </option>
                {/each}

            </select>

            <button
                type="submit"
                class="action-btn small-btn"
            >
                Add
            </button>

        </form>

    </div>

    <div class="collab-column">

        <h3>Viewers</h3>

        <div class="collab-list">

            {#each viewerUsers as user}

                <div class="collab-item">

                    <span>{user.username}</span>

                    <form
                        method="POST"
                        action="?/removeViewer"
                    >

                        <input
                            type="hidden"
                            name="userId"
                            value={user.id}
                        />

                        <input
                            type="hidden"
                            name="contractId"
                            value={contractId}
                        />

                        <button
                            type="submit"
                            class="text-btn"
                        >
                            Remove
                        </button>

                    </form>

                </div>

            {/each}

        </div>

        <form
            method="POST"
            action="?/addViewer"
            class="add-form"
        >

            <input
                type="hidden"
                name="contractId"
                value={contractId}
            />

            <select
                name="userId"
                required
                class="select-input"
            >

                <option value="">
                    Add viewer
                </option>

                {#each availableViewers as user}
                    <option value={user.id}>
                        {user.username}
                    </option>
                {/each}

            </select>

            <button
                type="submit"
                class="action-btn small-btn"
            >
                Add
            </button>

        </form>

    </div>

</div>
<style>
.collaborators-panel {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 2rem;
    }

    .collab-column h3 {
        font-family: 'Poppins', sans-serif;
        font-size: 1.1rem;
        margin: 0 0 1rem 0;
        color: #374151;
    }

    .collab-list {
        margin-bottom: 1rem;
    }

    .collab-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 0.9rem;
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

    transition:
        background 0.2s ease,
        transform 0.15s ease;
}

.small-btn:hover {
    background: #374151;
    transform: translateY(-1px);
}

.small-btn:active {
    transform: scale(0.96);
}

    .small-btn:hover {
        background-color: #374151;
    }

    </style>