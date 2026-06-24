<script lang="ts">
    import { onMount } from 'svelte'; 
    import { fade } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { ArrowUpDown, SquareChevronUp, SquareChevronDown, ChevronDown, Trash2, Upload, FilePlusCorner } from 'lucide-svelte';
    import { supabase } from "$lib/supabaseInit"; 

    let { data } = $props();
    let { access, contracts, users, session_id} = $derived(data); 

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

    let showYearDropdown = $state(false);
    let showTypeDropdown = $state(false);
    let showStatusDropdown = $state(false);

    let yearValues = $derived(($page.url.searchParams.get('year') || '').split(',').filter(Boolean));
    let typeValues = $derived(($page.url.searchParams.get('type') || '').split(',').filter(Boolean));
    let statusValues = $derived(($page.url.searchParams.get('status') || '').split(',').filter(Boolean));
    let searchValue = $derived(($page.url.searchParams.get('search') || '').toLowerCase());

    let currentSort = $derived($page.url.searchParams.get('sort') || 'last_modified-desc');
    let sortKey = $derived(currentSort.split('-')[0]);
    let sortAsc = $derived(currentSort.split('-')[1] === 'asc');

    const visibleContracts = $derived(
        (contracts ?? [])
            .filter(contract =>
                contract.editors?.includes(session_id) ||
                contract.viewers?.includes(session_id)
            )
            .filter(c => {
                if (yearValues.length > 0) {
                    const y = new Date(c.created_at).getFullYear().toString();
                    if (!yearValues.includes(y)) return false;
                }
                if (typeValues.length > 0 && !typeValues.includes(c.type)) return false;
                if (statusValues.length > 0 && !statusValues.includes(c.status)) return false;
                if (searchValue && !c.title?.toLowerCase().includes(searchValue)) return false;
                return true;
            })
            .sort((a, b) => {
                let aVal: any, bVal: any;
                if (sortKey === 'title') {
                    aVal = a.title?.toLowerCase() ?? '';
                    bVal = b.title?.toLowerCase() ?? '';
                } else {
                    aVal = a[sortKey] ?? '';
                    bVal = b[sortKey] ?? '';
                }
                if (aVal < bVal) return sortAsc ? -1 : 1;
                if (aVal > bVal) return sortAsc ? 1 : -1;
                return 0;
            })
            ?? []
    );

    function navigate(url: URL) {
        goto(url.toString(), { keepFocus: true, noScroll: true, replaceState: true });
    }

    function toggleFilter(key: string, value: string) {
        const current = ($page.url.searchParams.get(key) || '').split(',').filter(Boolean);
        const next = current.includes(value)
            ? current.filter(v => v !== value)
            : [...current, value];
        const newUrl = new URL($page.url);
        if (next.length === 0) {
            newUrl.searchParams.delete(key);
        } else {
            newUrl.searchParams.set(key, next.join(','));
        }
        navigate(newUrl);
    }

    function toggleDropdown(name: 'year' | 'type' | 'status') {
        showYearDropdown = name === 'year' ? !showYearDropdown : false;
        showTypeDropdown = name === 'type' ? !showTypeDropdown : false;
        showStatusDropdown = name === 'status' ? !showStatusDropdown : false;
    }

    function closeAllDropdowns() {
        showYearDropdown = false;
        showTypeDropdown = false;
        showStatusDropdown = false;
    }

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
        const newUrl = new URL($page.url);
        if (value === '') {
            newUrl.searchParams.delete(key);
        } else {
            newUrl.searchParams.set(key, value);
        }
        navigate(newUrl);
    }

    function updateSort(key: string) {
        const newUrl = new URL($page.url);
        let newOrder = 'asc';
        if (sortKey === key) {
            newOrder = sortAsc ? 'desc' : 'asc';
        }
        newUrl.searchParams.set('sort', `${key}-${newOrder}`);
        navigate(newUrl);
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
                const validStatuses = ['Active', 'Draft', 'On Hold', 'Completed', 'Terminated'];
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

<svelte:window onclick={closeAllDropdowns} />

{#if access !== "Workflow Manager" && access !== "Contract Manager" && access !== "Contract Viewer"}
    <h1 style="text-align:center; margin-top: 4rem;">You do not have access to view this page. <br> Please contact a Workflow Manager or a Contract Manager.</h1>
{:else}
<div class="main-content">
    <div class="header">
        <h1 class="page-title">Contract Records List</h1>
    </div>
    <div class="controls">
            
            <div class="search-wrapper">
                <input 
                    type="text" 
                    placeholder="Search contracts" 
                    class="search-input"
                    value={$page.url.searchParams.get('search') || ''}
                    oninput={(e) => updateFilter('search', e.currentTarget.value)}
                />
            </div>

            <div class="multi-select-wrap" onclick={(e) => e.stopPropagation()}>
                <button class="multi-select-trigger" onclick={(e) => { e.stopPropagation(); toggleDropdown('year'); }}>
                    <span>Year</span>
                    <ChevronDown size={14} />
                </button>
                {#if showYearDropdown}
                    <div class="multi-select-dropdown" onclick={(e) => e.stopPropagation()}>
                        {#each ['2026', '2025', '2024'] as y}
                            <label class="multi-select-option">
                                <input type="checkbox" checked={yearValues.includes(y)} onchange={() => toggleFilter('year', y)} />
                                <span>{y}</span>
                            </label>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="multi-select-wrap" onclick={(e) => e.stopPropagation()}>
                <button class="multi-select-trigger" onclick={(e) => { e.stopPropagation(); toggleDropdown('type'); }}>
                    <span>Type</span>
                    <ChevronDown size={14} />
                </button>
                {#if showTypeDropdown}
                    <div class="multi-select-dropdown" onclick={(e) => e.stopPropagation()}>
                        {#each existingTypes as t}
                            <label class="multi-select-option">
                                <input type="checkbox" checked={typeValues.includes(t)} onchange={() => toggleFilter('type', t)} />
                                <span>{t}</span>
                            </label>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="multi-select-wrap" onclick={(e) => e.stopPropagation()}>
                <button class="multi-select-trigger" onclick={(e) => { e.stopPropagation(); toggleDropdown('status'); }}>
                    <span>Status</span>
                    <ChevronDown size={14} />
                </button>
                {#if showStatusDropdown}
                    <div class="multi-select-dropdown" onclick={(e) => e.stopPropagation()}>
                        {#each ['Active', 'Draft', 'On Hold', 'Completed', 'Terminated'] as s}
                            <label class="multi-select-option">
                                <input type="checkbox" checked={statusValues.includes(s)} onchange={() => toggleFilter('status', s)} />
                                <span>{s}</span>
                            </label>
                        {/each}
                    </div>
                {/if}
            </div>

            <button class="action-btn csv-btn" onclick={() => showCsvModal = true}>
                <Upload size={16} strokeWidth={2.5} />
                <span>Import CSV</span>
            </button>

            <a href="/create-contract" class="action-btn create-btn">
                <FilePlusCorner size={16} strokeWidth={2.5} />
                <span>Create Contract</span>
            </a>
        </div>

    {#if yearValues.length > 0 || typeValues.length > 0 || statusValues.length > 0}
        <div class="chips-container">
            {#if yearValues.length > 0}
                <div class="chips-group">
                    <span class="chips-label">Year:</span>
                    <div class="chips-list">
                        {#each yearValues as y}
                            <span class="chip chip-year" onclick={() => toggleFilter('year', y)}>{y}<span class="chip-remove">&times;</span></span>
                        {/each}
                    </div>
                </div>
            {/if}
            {#if typeValues.length > 0}
                <div class="chips-group">
                    <span class="chips-label">Type:</span>
                    <div class="chips-list">
                        {#each typeValues as t}
                            <span class="chip chip-type" onclick={() => toggleFilter('type', t)}>{t}<span class="chip-remove">&times;</span></span>
                        {/each}
                    </div>
                </div>
            {/if}
            {#if statusValues.length > 0}
                <div class="chips-group">
                    <span class="chips-label">Status:</span>
                    <div class="chips-list">
                        {#each statusValues as s}
                            <span class="chip chip-status" onclick={() => toggleFilter('status', s)}>{s}<span class="chip-remove">&times;</span></span>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/if}

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
                                    <ArrowUpDown size={16} strokeWidth={1.5} opacity={0.5} />
                                {/if}
                            </div>
                        </th>
                    {/each}
                    <th class="th-action"></th>
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
                                    class:status-draft={contract.status === 'Draft'}
                                    class:status-completed={contract.status === 'Completed'}
                                    class:status-terminated={contract.status === 'Terminated'}
                                    class:status-hold={contract.status === 'On Hold'}
                                    value={contract.status}
                                    onchange={(e) => initiateStatusUpdate(contract, e.currentTarget.value)}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Draft">Draft</option>
                                    <option value="On Hold">On Hold</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Terminated">Terminated</option>
                                </select>
                            </td>
                            <td class="td-action">
                                <button class="row-delete-btn" onclick={() => confirmDelete([contract])} title="Delete contract">
                                    <Trash2 size={15} strokeWidth={2.5} />
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
        width: 100%;
        box-sizing: border-box;
    }

    .header {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.5rem;
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
        justify-content: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-input {
        padding: 10px 10px 10px 40px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        width: 300px;
        outline: none;
        transition: border-color 0.2s;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: 12px center;
        background-size: 18px;
    }

    .search-input:focus {
        border-color: #02461C;
        box-shadow: 0 0 0 2px rgba(2, 70, 28, 0.1);
    }

    .multi-select-wrap {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .multi-select-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 14px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background-color: white;
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        color: #374151;
        cursor: pointer;
        outline: none;
        white-space: nowrap;
        min-width: 140px;
        transition: border-color 0.2s;
    }

    .multi-select-trigger:hover {
        border-color: #02461C;
    }

    .multi-select-trigger:focus-visible {
        border-color: #02461C;
        box-shadow: 0 0 0 2px rgba(2, 70, 28, 0.1);
    }

    .multi-select-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 4px;
        width: max-content;
        min-width: 100%;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 100;
        padding: 6px 0;
        max-height: 240px;
        overflow-y: auto;
    }

    .multi-select-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        cursor: pointer;
        font-size: 0.9rem;
        color: #374151;
        transition: background-color 0.15s;
    }

    .multi-select-option:hover {
        background-color: #f3f4f6;
    }

    .multi-select-option input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: #7B1113;
    }



    .chips-container {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 24px;
        padding: 8px 4px;
        align-items: center;
    }

    .chips-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .chips-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #374151;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .chips-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        user-select: none;
    }

    .chip:hover {
        opacity: 0.8;
    }

    .chip-year {
        background-color: #dbeafe;
        color: #1e40af;
    }

    .chip-type {
        background-color: #d1fae5;
        color: #065f46;
    }

    .chip-status {
        background-color: #ede9fe;
        color: #5b21b6;
    }

    .chip-remove {
        font-size: 1rem;
        line-height: 1;
        margin-left: 2px;
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
        text-align: center;
        padding: 14px 20px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #fbf9f9;
        letter-spacing: 0.05em;
        transition: background-color 0.2s;
        outline: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    }

    th:focus, th:focus-visible, th:active {
        outline: none;
        box-shadow: none;
    }

    th:hover {
        background-color: #5a0c0e;
    }

    .th-content {
        display: flex;
        align-items: center;
        justify-content: center;
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

    .th-checkbox, .td-checkbox { width: 48px; text-align: center; }
    .th-checkbox input, .td-checkbox input { width: 18px; height: 18px; cursor: pointer; accent-color: #7B1113; }
    .th-action, .td-action { width: 48px; text-align: center; }
    .row-delete-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #9ca3af;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.15s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .row-delete-btn:hover {
        color: #dc2626;
        background-color: #fef2f2;
    }

    tr.selected { background-color: #fef2f2; }
    tr.selected:hover { background-color: #fde8e8; }

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

    .create-btn {
        background-color: #035a24; color: white; text-decoration: none;
    }
    .create-btn:hover { background-color: #02451C; }

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
    .status-draft { color: #6b7280; background-color: #f3f4f6; }
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

    @media (max-width: 768px) {
        .main-content { padding: 1rem; }
        .page-title { font-size: 1.5rem; }
        .controls { flex-direction: column; align-items: stretch; }
        .search-input { width: 100%; }
        .multi-select-wrap { width: 100%; }
        .multi-select-trigger { width: 100%; justify-content: space-between; }
        .multi-select-dropdown { width: 100%; min-width: 0; }
        .table-container { overflow-x: auto; }
        th, td { padding: 10px 12px; font-size: 0.85rem; }
        .header { gap: 0.75rem; }
    }

    @media (max-width: 480px) {
        .page-title { font-size: 1.25rem; }
        th, td { padding: 8px 8px; font-size: 0.8rem; }
        .th-checkbox, .td-checkbox { width: 32px; }
        .action-btn { font-size: 0.8rem; padding: 6px 10px; }
    }
</style>