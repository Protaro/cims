<script lang="ts">
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';

    let { data, form } = $props()
    let { session, supabase, profile, users} = $derived(data)
    let profileForm: HTMLFormElement
    let loading = $state(false)
    let fullName: string = $derived(profile?.full_name)
    let username: string = $derived(profile?.username)
    let access_level: string = $derived(profile?.access_level)

    let isEditing: boolean = $state(false)

    let access_levels = ["Workflow Manager", "Contract Manager", "Contract Viewer"];

    const handleSubmit: SubmitFunction = () => {
        loading = true
        return async () => {
            loading = false
            isEditing = false
        }
    }
</script>

<div class="account-container">
    <h1 class="page-title">Welcome, {fullName || 'user'}!</h1>

    <div class="card">
        <div class="card-header">
            <h2 class="section-title">Account Details</h2>
            <div class="header-actions">
                {#if isEditing}
                    <button
                        type="submit"
                        form="profile-form"
                        class="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                {:else}
                    <button class="btn btn-secondary" onclick={() => isEditing = true}>
                        Edit Details
                    </button>
                {/if}
            </div>
        </div>

        <form
            id="profile-form"
            class="profile-form"
            method="post"
            action="?/update"
            use:enhance={handleSubmit}
            bind:this={profileForm}
        >
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label" for="fullName">Full Name</label>
                    <input class="input-field" id="fullName" name="fullName" type="text" value={form?.fullName ?? fullName} disabled={!isEditing} />
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="username">Username</label>
                    <input class="input-field" id="username" name="username" type="text" value={form?.username ?? username} disabled={!isEditing} />
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="email">Email</label>
                    <input class="input-field" id="email" type="text" value={session.user.email} disabled />
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="access_level">Access Level</label>
                    <input class="input-field" id="access_level" name="access_level" type="text" value={form?.access_level ?? access_level} disabled={access_level !== "Workflow Manager" || !isEditing} />
                </div>
            </div>
        </form>
    </div>

    {#if access_level === "Workflow Manager"}
        <div class="card">
            <h2 class="section-title">Registered Users</h2>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Full Name</th>
                            <th>Username</th>
                            <th>Access Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each users as user}
                            <tr>
                                <td><span class="fw-500">{user.full_name}</span></td>
                                <td class="text-muted">{user.username}</td>
                                <td>
                                    <form
                                        class="table-form"
                                        method="post"
                                        action="?/update_access_level"
                                        use:enhance={handleSubmit}
                                    >
                                        <input type="hidden" name="id" value={user.id} />
                                        <select class="select-field" name="access_level" bind:value={user.access_level}>
                                            {#each access_levels as level}
                                                <option value={level}>{level}</option>
                                            {/each}
                                        </select>
                                        <button
                                            type="submit"
                                            class="btn btn-secondary btn-sm"
                                            disabled={loading}
                                        >
                                            {loading ? '...' : 'Update'}
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>

<style>
    :global(body) {
        background-color: #f9fafb;
    }

    .account-container {
        max-width: 1100px;
        margin: 2rem auto;
        padding: 0 1.5rem;
        font-family: 'Poppins', sans-serif;
        width: 100%;
        box-sizing: border-box;
    }

    .page-title {
        font-size: 2.25rem;
        font-weight: 700;
        color: #02461C;
        margin: 0 0 1.5rem 0;
        word-break: break-word;
    }

    .card {
        background: white;
        border-radius: 12px;
        padding: 2rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        margin-bottom: 2rem;
        border: 1px solid #f3f4f6;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #e5e7eb;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .section-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    /* Form Styles */
    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
    }

    @media (max-width: 768px) {
        .account-container { padding: 0 1rem; margin: 1rem auto; }
        .page-title { font-size: 1.75rem; }
        .form-grid { grid-template-columns: 1fr; }
        .card { padding: 1.25rem; }
        .section-title { font-size: 1.25rem; }
    }

    @media (max-width: 480px) {
        .page-title { font-size: 1.5rem; }
        .card-header { flex-direction: column; align-items: flex-start; }
        .table-form { flex-direction: column; align-items: flex-start; }
        .select-field { min-width: 0; width: 100%; }
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #4b5563;
    }

    .input-field {
        padding: 0.75rem 1rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 1rem;
        font-family: inherit;
        transition: all 0.2s;
        color: #1f2937;
        background-color: #ffffff;
    }

    .input-field:focus:not(:disabled) {
        outline: none;
        border-color: #035a24;
        box-shadow: 0 0 0 3px rgba(3, 90, 36, 0.1);
    }

    .input-field:disabled {
        background-color: #f3f4f6;
        color: #9ca3af;
        cursor: not-allowed;
    }

    /* Buttons */
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.625rem 1.25rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background-color: #035a24;
        color: white;
        box-shadow: 0 2px 4px rgba(3, 90, 36, 0.2);
    }

    .btn-primary:hover:not(:disabled) {
        background-color: #02451C;
    }

    .btn-secondary {
        background-color: #f3f4f6;
        color: #374151;
        border-color: #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
        background-color: #e5e7eb;
    }

    .btn-sm {
        padding: 0.4rem 0.75rem;
        font-size: 0.875rem;
    }

    /* Table Styles */
    .table-responsive {
        overflow-x: auto;
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
        text-align: left;
    }

    .data-table th {
        background-color: #f9fafb;
        color: #4b5563;
        font-weight: 600;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 1rem;
        border-bottom: 2px solid #e5e7eb;
    }

    .data-table td {
        padding: 1rem;
        vertical-align: middle;
        border-bottom: 1px solid #f3f4f6;
        color: #1f2937;
    }

    .data-table tbody tr:hover {
        background-color: #f9fafb;
    }

    .fw-500 {
        font-weight: 500;
    }

    .text-muted {
        color: #6b7280;
    }

    /* Inline Table Form */
    .table-form {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .select-field {
        padding: 0.4rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.875rem;
        font-family: inherit;
        background-color: white;
        color: #1f2937;
        cursor: pointer;
        min-width: 180px;
    }
    
    .select-field:focus {
        outline: none;
        border-color: #035a24;
    }
</style>