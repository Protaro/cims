<script lang="ts">
    import { onMount } from 'svelte'; 
    import { fade } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { SquareChevronUp, SquareChevronDown, Search, Trash2, Upload } from 'lucide-svelte';
    import { supabase } from "$lib/supabaseInit"; 

    let { data } = $props();
    let { access, contracts, filters, users, session_id} = $derived(data); 

    const visibleContracts = $derived(
        contracts?.filter(contract =>
            contract.editors?.includes(session_id) ||
            contract.viewers?.includes(session_id)
        ) ?? []
    );

    let showConfirmModal = $state(false);
    let isUpdating = $state(false);
    let targetContract = $state<any>(null);
    let pendingStatus = $state("");

    let showDeleteModal = $state(false);
    let isDeleting = $state(false);
    let deleteTargets = $state<any[]>([]);

    let showCsvModal = $state(false);
    let csvFile = $state<File | null>(null);
    let csvImporting = $state(false);
    let csvResult = $state("");
    
    let selectedIds = $state<Set<string>>(new Set());
    let existingTypes = $state<string[]>([]);

    let currentSort = $derived($page.url.searchParams.get('sort') || 'last_modified-desc');
    let sortKey = $derived(currentSort.split('-')[0]);
    let sortAsc = $derived(currentSort.split('-')[1] === 'asc');

    let allSelected = $derived(
        visibleContracts.length > 0 && selectedIds.size === visibleContracts.length
    );

    onMount(async () => {
        const { data: contractData, error } = await supabase
            .from('contracts')
            .select('type');
            
        if (contractData && !error) {
            const uniqueTypes = [...new Set(contractData.map(d => d.type).filter(Boolean))];
            existingTypes = uniqueTypes as string[];
        }
    });

    function updateFilter(key: string, value: string) {
        const newUrl = new URL(window.location.href);
        if (value === 'All' || value === '') {
            newUrl.searchParams.delete(key);
        } else {
            newUrl.searchParams.set(key, value);
        }
        goto(newUrl.toString(), { keepFocus: true, noScroll: true });
    }

    function updateSort(key: string) {
        const newUrl = new URL(window.location.href);
        let newOrder = 'asc';
        if (sortKey === key) {
            newOrder = sortAsc ? 'desc' : 'asc';
        }
        newUrl.searchParams.set('sort', `${key}-${newOrder}`);
        goto(newUrl.toString(), { keepFocus: true, noScroll: true });
    }

    function toggleSelect(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        selectedIds = next;
    }

    function toggleSelectAll() {
        if (allSelected) {
            selectedIds = new Set();
        } else {
            selectedIds = new Set(visibleContracts.map((c: any) => c.id));
        }
    }

    function clearSelection() {
        selectedIds = new Set();
    }

    function initiateStatusUpdate(contract: any, newStatus: string) {
        if (contract.status === newStatus) return;
    
        targetContract = contract;
        pendingStatus = newStatus;
        showConfirmModal = true;
    }

    async function confirmStatusUpdate() {
        if (!targetContract) return;
        isUpdating = true;

        try {
            const { error } = await supabase
                .from('contracts') 
                .update({ status: pendingStatus })
                .eq('id', targetContract.id);

            if (error) throw error;

            await invalidateAll();
            showConfirmModal = false;
        } catch (err) {
            console.error("Update failed:", err);
            alert("Failed to update status.");
        } finally {
            isUpdating = false;
        }
    }

    function confirmDelete(targets: any[]) {
        deleteTargets = targets;
        showDeleteModal = true;
    }

    async function executeDelete() {
        if (deleteTargets.length === 0) return;
        isDeleting = true;

        try {
            const ids = deleteTargets.map(t => t.id);

            const { error } = await supabase
                .from('contracts')
                .delete()
                .in('id', ids);

            if (error) throw error;

            await invalidateAll();
            showDeleteModal = false;
            selectedIds = new Set();
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete contract(s).");
        } finally {
            isDeleting = false;
        }
    }

    function handleCsvFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            csvFile = input.files[0];
        }
    }

    async function importCsv() {
        if (!csvFile) return;
        csvImporting = true;
        csvResult = "";

        try {
            const text = await csvFile.text();
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length < 2) {
                csvResult = "CSV must have a header row and at least one data row.";
                csvImporting = false;
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const titleIdx = headers.indexOf('title');
            const typeIdx = headers.indexOf('type');
            const statusIdx = headers.indexOf('status');

            if (titleIdx === -1) {
                csvResult = "CSV must have a 'title' column.";
                csvImporting = false;
                return;
            }

            const userId = session_id;
            let imported = 0;
            let errors = 0;

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim());
                const title = cols[titleIdx] || `Imported Contract ${i}`;
                const type = typeIdx >= 0 ? (cols[typeIdx] || 'Standard') : 'Standard';
                const status = statusIdx >= 0 ? (cols[statusIdx] || 'Active') : 'Active';
                const validStatuses = ['Active', 'On Hold', 'Completed', 'Terminated'];
                const finalStatus = validStatuses.includes(status) ? status : 'Active';

                const { error } = await supabase.from('contracts').insert({
                    title,
                    type,
                    status: finalStatus,
                    editors: [userId],
                    viewers: [userId],
                    last_modified: new Date().toISOString()
                });

                if (error) {
                    console.error(`Row ${i} error:`, error);
                    errors++;
                } else {
                    imported++;
                }
            }

            csvResult = `Imported ${imported} contract(s) successfully${errors > 0 ? ` (${errors} errors)` : ''}.`;
            if (imported > 0) {
                await invalidateAll();
                csvFile = null;
            }
        } catch (err) {
            console.error("CSV import error:", err);
            csvResult = "Failed to parse CSV file.";
        } finally {
            csvImporting = false;
        }
    }

    function formatDate(dateString: string) {
        if (!dateString) return '--';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

{#if access !== "Workflow Manager" && access !== "Contract Manager" && access !== "Contract Viewer"}
    <h1 style="text-align:center; margin-top: 4rem;">You do not have access to view this page. <br> Please contact a Workflow Manager or a Contract Manager.</h1>
{:else}
<div class="main-content">
    <div class="header">
        <h1 class="page-title">Contract Records List</h1>
        <div class="controls">
            
            <div class="search-wrapper">
                <Search class="search-icon" size={18} color="#6b7280" />
                <input 
                    type="text" 
                    placeholder="Search contracts" 
                    class="search-input"
                    value={filters.search}
                    oninput={(e) => updateFilter('search', e.currentTarget.value)}
                />
            </div>

            <select class="filter-select" value={filters.year} onchange={(e) => updateFilter('year', e.currentTarget.value)}>
                <option value="All">Year</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
            </select>

            <select class="filter-select" value={filters.type} onchange={(e) => updateFilter('type', e.currentTarget.value)}>
                <option value="All">Type</option>
                {#each existingTypes as type}
                    <option value={type}>{type}</option>
                {/each}
            </select>

            <select class="filter-select" value={filters.status} onchange={(e) => updateFilter('status', e.currentTarget.value)}>
                <option value="All">Status</option>
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Terminated">Terminated</option>
            </select>

            <button class="action-btn csv-btn" onclick={() => showCsvModal = true}>
                <Upload size={16} strokeWidth={2.5} />
                <span>Import CSV</span>
            </button>
        </div>
    </div>

    {#if selectedIds.size > 0}
        <div class="bulk-bar">
            <span class="bulk-count">{selectedIds.size} selected</span>
            <button class="action-btn bulk-delete-btn" onclick={() => {
                const targets = visibleContracts.filter((c: any) => selectedIds.has(c.id));
                confirmDelete(targets);
            }}>
                <Trash2 size={16} strokeWidth={2.5} />
                <span>Delete Selected</span>
            </button>
            <button class="action-btn bulk-clear-btn" onclick={clearSelection}>
                Clear Selection
            </button>
        </div>
    {/if}

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th class="th-checkbox">
                        <input type="checkbox" checked={allSelected} onchange={toggleSelectAll} />
                    </th>
                    {#each ['title', 'created_at', 'last_modified', 'type', 'status'] as column}
                        <th onclick={() => updateSort(column)} style="cursor: pointer;">
                            <div class="th-content">
                                {column === 'created_at' ? 'CREATED ON' : 
                                 column === 'last_modified' ? 'LAST MODIFIED ON' : 
                                 column.toUpperCase()}
                                
                                {#if sortKey === column}
                                    {#if sortAsc}
                                        <SquareChevronUp size={16} strokeWidth={2.5} />
                                    {:else}
                                        <SquareChevronDown size={16} strokeWidth={2.5} />
                                    {/if}
                                {:else}
                                    <span style="width: 16px;"></span> 
                                {/if}
                            </div>
                        </th>
                    {/each}
                    <th class="th-actions">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                {#if visibleContracts.length === 0}
                    <tr>
                        <td colspan="7" style="text-align: center; color: #6b7280; padding: 2rem;">
                            No contracts found matching your filters.
                        </td>
                    </tr>
                {:else}
                    {#each visibleContracts as contract (contract.id)}
                        <tr in:fade animate:flip={{duration: 450}} class:selected={selectedIds.has(contract.id)}>
                            <td class="td-checkbox">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.has(contract.id)} 
                                    onchange={() => toggleSelect(contract.id)} 
                                />
                            </td>
                            <td>
                                <a href="/view/{contract.id}" class="contract-link">
                                    {contract.title}
                                </a>
                            </td>
                            <td class="date-cell">{formatDate(contract.created_at)}</td>
                            <td class="date-cell">{formatDate(contract.last_modified)}</td>
                            <td>
                                <span class="type-badge">{contract.type}</span>
                            </td>
                            <td>
                                <select 
                                    class="status-dropdown" 
                                    class:status-active={contract.status === 'Active'}
                                    class:status-completed={contract.status === 'Completed'}
                                    class:status-terminated={contract.status === 'Terminated'}
                                    class:status-hold={contract.status === 'On Hold'}
                                    value={contract.status}
                                    onchange={(e) => initiateStatusUpdate(contract, e.currentTarget.value)}
                                >
                                    <option value="Active">Active</option>
                                    <option value="On Hold">On Hold</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Terminated">Terminated</option>
                                </select>
                            </td>
                            <td class="td-actions">
                                <button class="icon-btn delete-row-btn" onclick={() => confirmDelete([contract])} title="Delete contract">
                                    <Trash2 size={16} strokeWidth={2} />
                                </button>
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
</div>

<!-- Status Update Modal -->
{#if showConfirmModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Update Status</h3>
            <p>
                Are you sure you want to change the status of 
                <strong>"{targetContract?.title}"</strong> to 
                <span class="status-highlight">{pendingStatus}</span>?
            </p>
            
            <div class="modal-actions">
                <button 
                    class="btn-cancel" 
                    onclick={() => { showConfirmModal = false; targetContract = null; }} 
                    disabled={isUpdating}
                >
                    Cancel
                </button>
                <button 
                    class="btn-confirm" 
                    onclick={confirmStatusUpdate} 
                    disabled={isUpdating}
                >
                    {isUpdating ? 'Updating...' : 'Confirm Update'}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Delete Contract{deleteTargets.length > 1 ? 's' : ''}</h3>
            <p>
                Are you sure you want to delete 
                <strong>{deleteTargets.length === 1 ? `"${deleteTargets[0]?.title}"` : `${deleteTargets.length} contracts`}</strong>?
                <br/>This action cannot be undone.
            </p>
            
            <div class="modal-actions">
                <button 
                    class="btn-cancel" 
                    onclick={() => { showDeleteModal = false; deleteTargets = []; }} 
                    disabled={isDeleting}
                >
                    Cancel
                </button>
                <button 
                    class="btn-danger" 
                    onclick={executeDelete} 
                    disabled={isDeleting}
                >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- CSV Import Modal -->
{#if showCsvModal}
    <div class="modal-overlay">
        <div class="modal-content">
            <h3>Import Contracts from CSV</h3>
            <p class="csv-help">
                Upload a CSV file with at least a <strong>title</strong> column. 
                Optional columns: <strong>type</strong>, <strong>status</strong>.
            </p>
            
            <div class="csv-upload-zone">
                <input type="file" accept=".csv" onchange={handleCsvFileSelect} id="csv-input" class="csv-input" />
                <label for="csv-input" class="csv-label">
                    {csvFile ? csvFile.name : 'Choose CSV file...'}
                </label>
            </div>

            {#if csvResult}
                <p class="csv-result" class:csv-success={csvResult.includes('successfully')}>{csvResult}</p>
            {/if}

            <div class="modal-actions">
                <button 
                    class="btn-cancel" 
                    onclick={() => { showCsvModal = false; csvFile = null; csvResult = ""; }} 
                    disabled={csvImporting}
                >
                    Cancel
                </button>
                <button 
                    class="btn-confirm" 
                    onclick={importCsv} 
                    disabled={!csvFile || csvImporting}
                >
                    {csvImporting ? 'Importing...' : 'Import CSV'}
                </button>
            </div>
        </div>
    </div>
{/if}
{/if}

<style>
    :global(body) {
        font-family: 'Poppins', sans-serif;
        background-color: #f9fafb; 
    }

    .main-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
        display: grid;
        gap: 2rem;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .page-title {
        font-size: 2rem;
        font-weight: 700;
        color: #02461C;
        margin: 0;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-icon {
        position: absolute;
        left: 12px;
        pointer-events: none;
    }

    .search-input {
        padding: 10px 10px 10px 36px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        width: 300px;
        outline: none;
        transition: border-color 0.2s;
    }

    .search-input:focus {
        border-color: #02461C;
        box-shadow: 0 0 0 2px rgba(2, 70, 28, 0.1);
    }

    .filter-select {
        padding: 10px 14px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background-color: white;
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        color: #374151;
        cursor: pointer;
        outline: none;
    }

    .filter-select:focus {
        border-color: #02461C;
    }

    .table-container {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    thead {
        background-color: #7B1113;
    }

    th {
        text-align: left;
        padding: 14px 20px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #fbf9f9;
        letter-spacing: 0.05em;
        transition: background-color 0.2s;
    }

    th:hover {
        background-color: #5a0c0e;
    }

    .th-content {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    tbody tr {
        border-bottom: 1px solid #e5e7eb;
        transition: background-color 0.15s;
    }

    tbody tr:last-child {
        border-bottom: none;
    }

    tbody tr:hover {
        background-color: #f9fafb;
    }

    td {
        padding: 16px 20px;
        color: #1f2937;
        font-size: 0.95rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    th:nth-child(1), td:nth-child(1) { width: 36%; } /* Title */
    th:nth-child(2), td:nth-child(2) { width: 14%; } /* Created */
    th:nth-child(3), td:nth-child(3) { width: 14%; } /* Modified */
    th:nth-child(4), td:nth-child(4) { width: 18%; } /* Type */
    th:nth-child(5), td:nth-child(5) { width: 10%; } /* Status */
    th:nth-child(6), td:nth-child(6) { width: 8%; } /* Actions */

    .th-checkbox, .td-checkbox { width: 40px; text-align: center; }
    .th-checkbox input, .td-checkbox input { width: 18px; height: 18px; cursor: pointer; accent-color: #7B1113; }
    .th-actions { width: 70px; text-align: center; }
    .td-actions { text-align: center; }

    tr.selected { background-color: #fef2f2; }
    tr.selected:hover { background-color: #fde8e8; }

    .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        color: #9ca3af;
        transition: all 0.15s;
    }
    .icon-btn:hover { background-color: #fee2e2; color: #dc2626; }

    .action-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 14px; border: none; border-radius: 8px;
        cursor: pointer; font-family: 'Poppins', sans-serif;
        font-weight: 600; font-size: 0.85rem;
        transition: all 0.2s; white-space: nowrap;
    }
    .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .csv-btn {
        background-color: #035a24; color: white;
    }
    .csv-btn:hover { background-color: #02451C; }

    .bulk-bar {
        display: flex; align-items: center; gap: 12px;
        background: #7B1113; color: white; padding: 10px 20px;
        border-radius: 10px; margin-bottom: 0;
    }
    .bulk-count { font-weight: 600; font-size: 0.9rem; margin-right: auto; }
    .bulk-delete-btn { background-color: white; color: #7B1113; }
    .bulk-delete-btn:hover { background-color: #fef2f2; }
    .bulk-clear-btn { background: transparent; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.3); }
    .bulk-clear-btn:hover { background: rgba(255,255,255,0.1); color: white; }

    .btn-danger {
        background: #dc2626; color: white; border: none;
        padding: 10px 25px; border-radius: 8px; cursor: pointer;
        font-weight: 600; transition: background 0.2s;
    }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }

    .csv-help { font-size: 0.9rem; color: #6b7280; margin-bottom: 16px; line-height: 1.5; }
    .csv-upload-zone { margin-bottom: 16px; }
    .csv-input { display: none; }
    .csv-label {
        display: block; padding: 12px; border: 2px dashed #d1d5db;
        border-radius: 8px; text-align: center; cursor: pointer;
        color: #4b5563; font-size: 0.9rem; transition: border-color 0.2s;
    }
    .csv-label:hover { border-color: #035a24; }
    .csv-result { font-size: 0.9rem; padding: 8px; border-radius: 6px; margin-bottom: 12px; }
    .csv-success { color: #035a24; background: #e6f4ea; }

    .delete-row-btn { margin: 0 auto; display: inline-flex; justify-content: center; }

    .contract-link {
        color: #02461C;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.15s;
    }

    .contract-link:hover {
        text-decoration: underline;
        color: #7B1113;
    }

    .date-cell {
        color: #6b7280;
        font-size: 0.9rem;
    }

    .type-badge {
        color: #6b7280;
        font-weight: 600;
    }

    .status-dropdown {
        border: 1px solid transparent;
        background: transparent;
        font-family: 'Poppins', sans-serif;
        font-weight: 600;
        cursor: pointer;
        outline: none;
        padding: 4px 8px;
        border-radius: 30px;
        font-size: 0.85rem;
        transition: all 0.2s;
        text-align: center;
    }

    .status-dropdown:hover {
        border-color: #d1d5db;
        background-color: white;
        color: #6b7280;
    }

    .status-active { color: #1e8e3e; background-color: #e6f4ea; }
    .status-completed { color: #1a73e8; background-color: #e8f0fe; }
    .status-terminated { color: #d93025; background-color: #fadbd8; }
    .status-hold { color: #f57c00; background-color: #fef0e0; }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        width: 450px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        text-align: center;
    }

    .modal-content h3 {
        margin-top: 0;
        color: #111827;
    }

    .status-highlight {
        font-weight: bold;
        color: #7B1113;
    }

    .modal-actions {
        display: flex;
        justify-content: center;
        gap: 15px;
        margin-top: 25px;
    }

    .btn-cancel {
        background: #f3f4f6;
        color: #4b5563;
        border: none;
        padding: 10px 25px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: background 0.2s;
    }

    .btn-cancel:hover:not(:disabled) {
        background: #e5e7eb;
    }

    .btn-confirm {
        background: #7B1113;
        color: white;
        border: none;
        padding: 10px 25px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: background 0.2s;
    }

    .btn-confirm:hover:not(:disabled) {
        background: #5a0c0e;
    }

    .btn-confirm:disabled, 
    .btn-cancel:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>