<script lang="ts">
    import { onMount } from 'svelte'; 
    import { fade } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { ChevronDown, Trash2, Upload, Download, FilePlusCorner } from 'lucide-svelte';
    import { supabase } from "$lib/supabaseInit"; 
    import { parseCsv } from '$lib/csvParser';
    import { uploadFiles, saveFileRecords, deleteFile } from '$lib/fileService';
    import * as XLSX from 'xlsx';
    import ManageAccessPanel from "$lib/components/ManageAccessPanel.svelte";

    let { data } = $props();
    let { access, contracts, groups, session_id, user_group} = $derived(data); 

    let showConfirmModal = $state(false);
    let isUpdating = $state(false);
    let targetContract = $state<any>(null);
    let pendingStatus = $state("");

    let showDeleteModal = $state(false);
    let isDeleting = $state(false);
    let deleteTargets = $state<any[]>([]);

    let showCsvModal = $state(false);
    let csvStep = $state<'upload' | 'preview' | 'result'>('upload');
    let csvFile = $state<File | null>(null);
    let csvAttachmentFiles = $state<File[]>([]);
    let csvParsedRows = $state<any[]>([]);
    let csvImporting = $state(false);
    let csvResult = $state('');
    let csvResultType = $state<'success' | 'error' | ''>('');
    let csvCreatedIds = $state<string[]>([]);
    let csvRolledBack = $state(false);

    let showExportModal = $state(false);
    let exportFormat = $state<'csv' | 'xlsx'>('csv');

    const VALID_STATUSES = ['Active', 'On Hold', 'Completed', 'Terminated'];
    const MAX_CSV_SIZE = 5 * 1024 * 1024;
    const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

    let selectedIds = $state<Set<string>>(new Set());
    let existingTypes = $state<string[]>([]);

    let showYearDropdown = $state(false);
    let showTypeDropdown = $state(false);
    let showStatusDropdown = $state(false);

    let yearShowNone = $state(false);
    let typeShowNone = $state(false);
    let statusShowNone = $state(false);

    let yearValues = $derived(($page.url.searchParams.get('year') || '').split(',').filter(Boolean));
    let typeValues = $derived(($page.url.searchParams.get('type') || '').split(',').filter(Boolean));
    let statusValues = $derived(($page.url.searchParams.get('status') || '').split(',').filter(Boolean));
    let searchValue = $derived(($page.url.searchParams.get('search') || '').toLowerCase());

    let currentSort = $derived($page.url.searchParams.get('sort') || 'last_modified:desc');
    let sortParts = $derived(currentSort.split(':'));
    let sortKey = $derived(sortParts[0]);
    let sortOrder = $derived(sortParts[1] || 'desc');
    let sortAsc = $derived(sortOrder === 'asc');
    let sortGroupValue = $derived(sortOrder !== 'asc' && sortOrder !== 'desc' ? sortOrder : null);

    let showManageAccess = $state(false);
    let selectedContractIds = $state<string[]>([]);

    const selectedContracts = $derived(
        (contracts ?? []).filter((c: any) => selectedContractIds.includes(c.id))
    );

    const allEditorIds = $derived([...new Set(selectedContracts.flatMap((c: any) => c.editors ?? []))]);
    const allViewerIds = $derived([...new Set(selectedContracts.flatMap((c: any) => c.viewers ?? []))]);
    
    const visibleContracts = $derived(
        (contracts ?? [])
            .filter(c => {
                if (!c.editors?.includes(session_id) && !c.viewers?.includes(session_id) &&
                    !c.editors?.includes(user_group) && !c.viewers?.includes(user_group)) {
                    return false;
                }
                if (yearValues.length > 0) {
                    const y = new Date(c.created_at).getFullYear().toString();
                    if (!yearValues.includes(y)) return false;
                } else if (yearShowNone) {
                    return false;
                }
                if (typeValues.length > 0) {
                    if (!typeValues.includes(c.type)) return false;
                } else if (typeShowNone) {
                    return false;
                }
                if (statusValues.length > 0) {
                    if (!statusValues.includes(c.status)) return false;
                } else if (statusShowNone) {
                    return false;
                }
                if (searchValue && !c.title?.toLowerCase().includes(searchValue)) return false;
                return true;
            })
            .sort((a, b) => {
                if (sortGroupValue && (sortKey === 'type' || sortKey === 'status')) {
                    const aMatch = a[sortKey] === sortGroupValue ? 0 : 1;
                    const bMatch = b[sortKey] === sortGroupValue ? 0 : 1;
                    if (aMatch !== bMatch) return aMatch - bMatch;
                }
                let aVal: string, bVal: string;
                if (sortKey === 'title') {
                    aVal = a.title?.toLowerCase() ?? '';
                    bVal = b.title?.toLowerCase() ?? '';
                } else {
                    aVal = (a[sortKey] ?? '').toLowerCase();
                    bVal = (b[sortKey] ?? '').toLowerCase();
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
            if (key === 'year') yearShowNone = true;
            if (key === 'type') typeShowNone = true;
            if (key === 'status') statusShowNone = true;
        } else {
            newUrl.searchParams.set(key, next.join(','));
            if (key === 'year') yearShowNone = false;
            if (key === 'type') typeShowNone = false;
            if (key === 'status') statusShowNone = false;
        }
        navigate(newUrl);
    }

    function toggleSelectAllFilter(key: string, allValues: string[]) {
        const current = ($page.url.searchParams.get(key) || '').split(',').filter(Boolean);
        let showNone = false;
        if (key === 'year') showNone = yearShowNone;
        if (key === 'type') showNone = typeShowNone;
        if (key === 'status') showNone = statusShowNone;
        const allSelected = current.length === 0 && !showNone || allValues.every(v => current.includes(v));
        const newUrl = new URL($page.url);
        if (allSelected) {
            newUrl.searchParams.delete(key);
            if (key === 'year') yearShowNone = true;
            if (key === 'type') typeShowNone = true;
            if (key === 'status') statusShowNone = true;
        } else {
            newUrl.searchParams.set(key, allValues.join(','));
            if (key === 'year') yearShowNone = false;
            if (key === 'type') typeShowNone = false;
            if (key === 'status') statusShowNone = false;
        }
        navigate(newUrl);
    }

    function allFilterSelected(key: string, allValues: string[]) {
        const current = ($page.url.searchParams.get(key) || '').split(',').filter(Boolean);
        if (current.length === 0) {
            if (key === 'year' && yearShowNone) return false;
            if (key === 'type' && typeShowNone) return false;
            if (key === 'status' && statusShowNone) return false;
            return true;
        }
        return allValues.every(v => current.includes(v));
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

    function getUniqueValues(key: string): string[] {
        return [...new Set((contracts ?? []).map(c => c[key]).filter(Boolean))];
    }

    function updateSort(key: string) {
        const newUrl = new URL($page.url);
        if ((key === 'type' || key === 'status') && contracts) {
            const uniqueValues = getUniqueValues(key);
            if (sortKey !== key) {
                newUrl.searchParams.set('sort', `${key}:asc`);
            } else if (sortOrder === 'asc') {
                newUrl.searchParams.set('sort', `${key}:desc`);
            } else if (sortOrder === 'desc') {
                newUrl.searchParams.set('sort', `${key}:${uniqueValues[0]}`);
            } else {
                const currentIdx = uniqueValues.indexOf(sortOrder);
                const nextIdx = currentIdx + 1;
                if (nextIdx < uniqueValues.length) {
                    newUrl.searchParams.set('sort', `${key}:${uniqueValues[nextIdx]}`);
                } else {
                    newUrl.searchParams.set('sort', `${key}:asc`);
                }
            }
        } else {
            let newOrder = 'asc';
            if (sortKey === key) {
                newOrder = sortAsc ? 'desc' : 'asc';
            }
            newUrl.searchParams.set('sort', `${key}:${newOrder}`);
        }
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
            const file = input.files[0];
            if (file.size > MAX_CSV_SIZE) {
                csvResult = `File exceeds ${MAX_CSV_SIZE / 1024 / 1024}MB limit.`;
                csvResultType = 'error';
                return;
            }
            csvFile = file;
            csvResult = '';
            csvResultType = '';
        }
    }

    function handleAttachmentSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            for (const file of Array.from(input.files)) {
                if (file.size > MAX_ATTACHMENT_SIZE) {
                    csvResult = `File "${file.name}" exceeds ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB limit.`;
                    csvResultType = 'error';
                    return;
                }
            }
            csvAttachmentFiles = [...csvAttachmentFiles, ...Array.from(input.files)];
            csvResult = '';
            csvResultType = '';
        }
    }

    function removeAttachmentFile(index: number) {
        csvAttachmentFiles = csvAttachmentFiles.filter((_, i) => i !== index);
    }

    async function parseAndPreview() {
        if (!csvFile) return;
        csvResult = '';
        csvResultType = '';

        try {
            let headers: string[];
            let rows: string[][];

            if (csvFile.name.endsWith('.xlsx')) {
                const data = await csvFile.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                if (jsonData.length < 2) {
                    csvResult = 'XLSX file appears empty or invalid.';
                    csvResultType = 'error';
                    return;
                }
                headers = jsonData[0].map((h: any) => String(h).toLowerCase());
                rows = jsonData.slice(1).filter((r: any[]) => r.some((f: any) => f !== undefined && f !== null && String(f).trim() !== ''))
                    .map((r: any[]) => r.map((f: any) => f !== undefined && f !== null ? String(f) : ''));
            } else {
                const text = await csvFile.text();
                const parsed = parseCsv(text);
                headers = parsed.headers;
                rows = parsed.rows;
            }

            if (headers.length === 0) {
                csvResult = 'File appears empty or invalid.';
                csvResultType = 'error';
                return;
            }

            const titleIdx = headers.indexOf('title');
            if (titleIdx === -1) {
                csvResult = "File must have a 'title' column.";
                csvResultType = 'error';
                return;
            }

            const typeIdx = headers.indexOf('type');
            const statusIdx = headers.indexOf('status');
            const workflowIdx = headers.indexOf('workflow_id');
            const filesIdx = headers.indexOf('files');

            if (rows.length === 0) {
                csvResult = 'File has no data rows.';
                csvResultType = 'error';
                return;
            }

            const parsed = rows.map((row, i) => {
                const errs: string[] = [];
                const title = row[titleIdx]?.trim() || '';
                if (!title) errs.push('Missing title');

                const type = typeIdx >= 0 ? (row[typeIdx]?.trim() || 'Standard') : 'Standard';
                const status = statusIdx >= 0 ? (row[statusIdx]?.trim() || 'Active') : 'Active';
                if (!VALID_STATUSES.includes(status)) {
                    errs.push(`Invalid status "${status}"`);
                }

                const workflow_id = workflowIdx >= 0 ? (row[workflowIdx]?.trim() || '') : '';
                const files = filesIdx >= 0
                    ? (row[filesIdx]?.split(';').map(f => f.trim()).filter(Boolean) || [])
                    : [];

                const missingFiles = files.filter(f => !csvAttachmentFiles.some(af => af.name === f));

                return {
                    index: i + 1,
                    title,
                    type,
                    status,
                    workflow_id,
                    files,
                    missingFiles,
                    valid: errs.length === 0 && missingFiles.length === 0,
                    errors: errs,
                };
            });

            csvParsedRows = parsed;
            csvStep = 'preview';
        } catch (err) {
            console.error('CSV parse error:', err);
            csvResult = 'Failed to parse file. Ensure it is a valid CSV or XLSX file.';
            csvResultType = 'error';
        }
    }

    async function importCsvFromPreview() {
        csvImporting = true;
        csvResult = '';
        csvResultType = '';
        csvCreatedIds = [];
        csvRolledBack = false;

        let imported = 0;
        const rowErrors: string[] = [];

        try {
            for (const row of csvParsedRows) {
                if (!row.valid) {
                    rowErrors.push(`Row ${row.index}: Skipped - ${row.errors.join('; ')}`);
                    continue;
                }

                const timestamp = new Date().toISOString();
                const { data: contract, error: insertError } = await supabase
                    .from('contracts')
                    .insert({
                        title: row.title,
                        type: row.type,
                        status: row.status,
                        editors: [user_group],
                        viewers: [user_group],
                        last_modified: timestamp
                    })
                    .select('id')
                    .single();

                if (insertError) {
                    throw new Error(`Row ${row.index}: ${insertError.message}`);
                }

                const contractId = contract.id;
                csvCreatedIds.push(contractId);

                if (row.workflow_id) {
                    const { data: workflow } = await supabase
                        .from('workflows')
                        .select('*, preworks(id,prework_bridge_table(prework_default_reqs(name))), approvals(*), activations(*), postworks(*)')
                        .eq('id', row.workflow_id)
                        .single();

                    if (workflow) {
                        const phaseOps: Promise<any>[] = [];

                        const preChecklist = workflow.preworks?.prework_bridge_table?.map((item: any) => ({
                            text: item.prework_default_reqs?.name || 'Requirement',
                            details: '',
                            done: false
                        })) || [];
                        if (preChecklist.length > 0) {
                            phaseOps.push(
                                (async () => { await supabase.from('contract_preworks').insert({ contract_id: contractId, checklist: preChecklist }); })()
                            );
                        }

                        let rawChecklist = workflow.approvals?.checklist;
                        const appStages = Array.isArray(rawChecklist) ? rawChecklist : (rawChecklist?.stages || []);
                        if (appStages.length > 0) {
                            phaseOps.push(
                                (async () => { await supabase.from('contract_approvals').insert({ contract_id: contractId, checklist: { stages: appStages } }); })()
                            );
                        }

                        const actParties = workflow.activations?.parties || [];
                        if (actParties.length > 0) {
                            phaseOps.push(
                                (async () => { await supabase.from('contract_activations').insert({ contract_id: contractId, parties: actParties }); })()
                            );
                        }

                        let rawPost = workflow.postworks?.checklist;
                        const milestones = Array.isArray(rawPost) ? rawPost : (rawPost?.milestones || []);
                        if (milestones.length > 0) {
                            phaseOps.push(
                                (async () => { await supabase.from('contract_postworks').insert({ contract_id: contractId, checklist: { milestones } }); })()
                            );
                        }

                        await Promise.all(phaseOps);
                    }
                }

                if (row.files.length > 0) {
                    const matchedFiles = csvAttachmentFiles.filter(af => row.files.includes(af.name));
                    if (matchedFiles.length > 0) {
                        const urls = await uploadFiles(contractId, matchedFiles);
                        await saveFileRecords('prework', contractId, urls);
                    }
                }

                imported++;
            }

            csvResult = `Imported ${imported} contract(s) successfully.`;
            if (rowErrors.length > 0) {
                csvResult += ` ${rowErrors.length} row(s) had errors and were skipped.`;
            }
            csvResultType = imported > 0 ? 'success' : 'error';

            if (imported > 0) {
                await invalidateAll();
            }

            csvStep = 'result';
        } catch (err: any) {
            console.error('CSV import failed:', err);

            if (csvCreatedIds.length > 0) {
                try {
                    for (const cid of csvCreatedIds) {
                        await Promise.all([
                            supabase.from('contract_preworks').delete().eq('contract_id', cid),
                            supabase.from('contract_approvals').delete().eq('contract_id', cid),
                            supabase.from('contract_activations').delete().eq('contract_id', cid),
                            supabase.from('contract_postworks').delete().eq('contract_id', cid),
                        ]);

                        const { data: fileRecords } = await supabase
                            .from('stage_files')
                            .select('file_url')
                            .eq('stage_id', cid);
                        if (fileRecords) {
                            for (const fr of fileRecords) {
                                try { await deleteFile('prework', cid, fr.file_url); } catch { }
                            }
                        }
                    }

                    await supabase.from('contracts').delete().in('id', csvCreatedIds);
                    csvRolledBack = true;
                } catch (rollbackErr) {
                    console.error('Rollback failed:', rollbackErr);
                }
            }

            csvResult = `${err.message || 'Import failed.'} ${csvRolledBack ? 'All changes rolled back.' : 'Some contracts may be partially created.'}`;
            csvResultType = 'error';
            csvStep = 'result';
        } finally {
            csvImporting = false;
        }
    }

    function resetCsvModal() {
        showCsvModal = false;
        csvStep = 'upload';
        csvFile = null;
        csvAttachmentFiles = [];
        csvParsedRows = [];
        csvImporting = false;
        csvResult = '';
        csvResultType = '';
        csvCreatedIds = [];
        csvRolledBack = false;
    }

    function confirmExport() {
        showExportModal = true;
    }

    function doExport() {
        const data = visibleContracts.map((c: any) => ({
            Title: c.title || '',
            Type: c.type || '',
            Status: c.status || '',
            'Created On': formatDate(c.created_at),
            'Last Modified': formatDate(c.last_modified),
        }));

        if (exportFormat === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contracts_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            const headers = ['Title', 'Type', 'Status', 'Created On', 'Last Modified'];
            const rows = visibleContracts.map((c: any) => [
                `"${(c.title || '').replace(/"/g, '""')}"`,
                c.type || '',
                c.status || '',
                formatDate(c.created_at),
                formatDate(c.last_modified),
            ]);
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contracts_export_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }

        showExportModal = false;
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
                        <label class="multi-select-option select-all-option">
                            <input type="checkbox" checked={allFilterSelected('year', ['2026', '2025', '2024'])} onchange={() => toggleSelectAllFilter('year', ['2026', '2025', '2024'])} />
                            <span>{allFilterSelected('year', ['2026', '2025', '2024']) ? 'Deselect All' : 'Select All'}</span>
                        </label>
                        <div class="select-all-divider"></div>
                        {#each ['2026', '2025', '2024'] as y}
                            <label class="multi-select-option">
                                <input type="checkbox" checked={yearValues.includes(y) || (!yearShowNone && !$page.url.searchParams.has('year'))} onchange={() => toggleFilter('year', y)} />
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
                        <label class="multi-select-option select-all-option">
                            <input type="checkbox" checked={allFilterSelected('type', existingTypes)} onchange={() => toggleSelectAllFilter('type', existingTypes)} />
                            <span>{allFilterSelected('type', existingTypes) ? 'Deselect All' : 'Select All'}</span>
                        </label>
                        <div class="select-all-divider"></div>
                        {#each existingTypes as t}
                            <label class="multi-select-option">
                                <input type="checkbox" checked={typeValues.includes(t) || (!typeShowNone && !$page.url.searchParams.has('type'))} onchange={() => toggleFilter('type', t)} />
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
                        <label class="multi-select-option select-all-option">
                            <input type="checkbox" checked={allFilterSelected('status', ['Active', 'On Hold', 'Completed', 'Terminated'])} onchange={() => toggleSelectAllFilter('status', ['Active', 'On Hold', 'Completed', 'Terminated'])} />
                            <span>{allFilterSelected('status', ['Active', 'On Hold', 'Completed', 'Terminated']) ? 'Deselect All' : 'Select All'}</span>
                        </label>
                        <div class="select-all-divider"></div>
                        {#each ['Active', 'On Hold', 'Completed', 'Terminated'] as s}
                            <label class="multi-select-option">
                                <input type="checkbox" checked={statusValues.includes(s) || (!statusShowNone && !$page.url.searchParams.has('status'))} onchange={() => toggleFilter('status', s)} />
                                <span>{s}</span>
                            </label>
                        {/each}
                    </div>
                {/if}
            </div>

            <button class="action-btn csv-btn" onclick={() => showCsvModal = true}>
                <Upload size={16} strokeWidth={2.5} />
                <span>Import List</span>
            </button>

            <button class="action-btn export-btn" onclick={confirmExport}>
                <Download size={16} strokeWidth={2.5} />
                <span>Export List</span>
            </button>

            <a href="/create-contract" class="action-btn create-btn">
                <FilePlusCorner size={16} strokeWidth={2.5} />
                <span>Create Contract</span>
            </a>
        </div>

    {#if (yearValues.length > 0 || (!yearShowNone && !$page.url.searchParams.has('year'))) || (typeValues.length > 0 || (!typeShowNone && !$page.url.searchParams.has('type'))) || (statusValues.length > 0 || (!statusShowNone && !$page.url.searchParams.has('status')))}
        <div class="chips-container">
            {#if yearValues.length > 0 || (!yearShowNone && !$page.url.searchParams.has('year'))}
            <div class="chips-group">
                <span class="chips-label">Year:</span>
                <div class="chips-list">
                    {#each yearValues.length > 0 ? yearValues : ['2026', '2025', '2024'] as y}
                        <span class="chip chip-year" onclick={() => toggleFilter('year', y)}>{y}<span class="chip-remove">&times;</span></span>
                    {/each}
                </div>
            </div>
            {/if}
            {#if typeValues.length > 0 || (!typeShowNone && !$page.url.searchParams.has('type'))}
            <div class="chips-group">
                <span class="chips-label">Type:</span>
                <div class="chips-list">
                    {#each typeValues.length > 0 ? typeValues : existingTypes as t}
                        <span class="chip chip-type" onclick={() => toggleFilter('type', t)}>{t}<span class="chip-remove">&times;</span></span>
                    {/each}
                </div>
            </div>
            {/if}
            {#if statusValues.length > 0 || (!statusShowNone && !$page.url.searchParams.has('status'))}
            <div class="chips-group">
                <span class="chips-label">Status:</span>
                <div class="chips-list">
                    {#each statusValues.length > 0 ? statusValues : ['Active', 'On Hold', 'Completed', 'Terminated'] as s}
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
        <button class="action-btn bulk-delete-btn" onclick={() => { const targets = visibleContracts.filter((c:any) => selectedIds.has(c.id) );confirmDelete(targets);}}>
        <Trash2 size={16}/>
        <span>Delete Selected</span>
    </button>

    <button class="action-btn bulk-clear-btn" onclick={clearSelection}>
        Clear Selection
    </button>
    <button
    class="action-btn bulk-manage-access-btn"
    disabled={selectedIds.size === 0}
    
    onclick={() => {
        selectedContractIds = visibleContracts
            .filter((c:any) => selectedIds.has(c.id))
            .map((c:any) => c.id);
    showManageAccess = true;
    }}>Manage Access </button>
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
                        <th onclick={() => updateSort(column)} class="sortable-th">
                            <div class="th-content">
                                {column === 'created_at' ? 'CREATED ON' : 
                                 column === 'last_modified' ? 'LAST MODIFIED ON' : 
                                 column.toUpperCase()}
                                <span class="sort-icon">
                                    {#if sortKey === column}
                                        {#if sortGroupValue && (column === 'type' || column === 'status')}
                                            {sortGroupValue}
                                        {:else if sortAsc}
                                            &#9650;
                                        {:else}
                                            &#9660;
                                        {/if}
                                    {/if}
                                </span>
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#if visibleContracts.length === 0}
                    <tr>
                        <td colspan="6" style="text-align: center; color: #6b7280; padding: 2rem;">
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
                            <td class="td-title">
                                <a href="/view/{contract.id}" class="contract-link" class:draft-title={!contract.status || contract.status === 'On Hold'}>
                                    {contract.title}{!contract.status || contract.status === 'On Hold' ? '*' : ''}
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

{#if showManageAccess && selectedContracts.length}
<div class="modal-overlay">
    <div class="modal-content access-modal">

        <div class="access-header">
            <h3>
                Manage Access
                {#if selectedContracts.length === 1}
                    — {selectedContracts[0].title}
                {:else}
                    ({selectedContracts.length} contracts)
                {/if}
            </h3>
        </div>

        <div class="manage-access-scroll">
            <ManageAccessPanel
                contractIds={selectedContractIds}
                groups={groups}
                editors={allEditorIds}
                viewers={allViewerIds}
            />
        </div>

        <div class="access-footer">
            <button class="btn-done" onclick={() => { showManageAccess = false; selectedContractIds = []; }}>
                Done
            </button>
        </div>
    </div>
</div>
{/if}

<!-- CSV Import Modal -->
{#if showCsvModal}
    <div class="modal-overlay" onclick={() => { if (!csvImporting) resetCsvModal(); }}>
        <div class="modal-content csv-modal-content" onclick={(e) => e.stopPropagation()}>
            {#if csvStep === 'upload'}
                <h3>Import Contracts</h3>
                <p class="csv-help">
                    Upload a CSV or XLSX file with at least a <strong>title</strong> column.
                    Optional columns: <strong>type</strong>, <strong>status</strong>, <strong>workflow_id</strong>, <strong>files</strong>.
                </p>

                <div class="csv-upload-zone">
                    <input type="file" accept=".csv,.xlsx" onchange={handleCsvFileSelect} id="csv-input" class="csv-input" />
                    <label for="csv-input" class="csv-label">
                        {csvFile ? csvFile.name : 'Choose CSV file...'}
                    </label>
                </div>

                <div class="csv-attachment-section">
                    <h4>Attachment Files</h4>
                    <p class="csv-help">Upload files referenced in the <strong>files</strong> column (semicolon-separated filenames).</p>
                    <input type="file" multiple onchange={handleAttachmentSelect} id="csv-attachment-input" class="csv-input" />
                    <label for="csv-attachment-input" class="csv-label csv-attachment-label">
                        {csvAttachmentFiles.length > 0 ? `${csvAttachmentFiles.length} file(s) selected` : 'Choose attachment files...'}
                    </label>
                    {#if csvAttachmentFiles.length > 0}
                        <div class="csv-file-list">
                            {#each csvAttachmentFiles as file, i}
                                <div class="csv-file-item">
                                    <span>{file.name}</span>
                                    <button class="csv-file-remove" onclick={() => removeAttachmentFile(i)}>×</button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if csvResult}
                    <p class="csv-result" class:csv-success={csvResultType === 'success'} class:csv-error={csvResultType === 'error'}>{csvResult}</p>
                {/if}

                <div class="modal-actions">
                    <button class="btn-cancel" onclick={resetCsvModal} disabled={csvImporting}>Cancel</button>
                    <button class="btn-confirm" onclick={parseAndPreview} disabled={!csvFile}>Preview</button>
                </div>

            {:else if csvStep === 'preview'}
                <h3>Preview Import</h3>
                <p class="csv-help">Review the parsed data below before importing.</p>

                <div class="csv-preview-table-wrap">
                    <table class="csv-preview-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Workflow</th>
                                <th>Files</th>
                                <th>Valid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each csvParsedRows as row}
                                <tr class:csv-row-valid={row.valid} class:csv-row-invalid={!row.valid}>
                                    <td>{row.index}</td>
                                    <td>{row.title || '(empty)'}</td>
                                    <td>{row.type}</td>
                                    <td>{row.status}</td>
                                    <td>{row.workflow_id ? row.workflow_id.slice(0, 8) + '...' : '—'}</td>
                                    <td>{row.files.length > 0 ? row.files.join(', ') : '—'}</td>
                                    <td>
                                        {#if row.valid}
                                            <span class="csv-badge csv-badge-ok">OK</span>
                                        {:else}
                                            <span class="csv-badge csv-badge-err" title={row.errors.join('; ')}>Error</span>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                {#if csvParsedRows.filter(r => !r.valid).length > 0}
                    <div class="csv-preview-errors">
                        <strong>Rows with errors:</strong>
                        {#each csvParsedRows.filter(r => !r.valid) as row}
                            <p class="csv-error-row">Row {row.index}: {row.errors.join('; ')}</p>
                        {/each}
                    </div>
                {/if}

                <div class="csv-summary">
                    <span>{csvParsedRows.length} total rows, {csvParsedRows.filter(r => r.valid).length} valid, {csvParsedRows.filter(r => !r.valid).length} with errors</span>
                </div>

                {#if csvResult}
                    <p class="csv-result" class:csv-success={csvResultType === 'success'} class:csv-error={csvResultType === 'error'}>{csvResult}</p>
                {/if}

                <div class="modal-actions">
                    <button class="btn-cancel" onclick={() => csvStep = 'upload'} disabled={csvImporting}>Back</button>
                    <button class="btn-confirm" onclick={importCsvFromPreview} disabled={csvImporting || csvParsedRows.filter(r => r.valid).length === 0}>
                        {csvImporting ? 'Importing...' : `Import ${csvParsedRows.filter(r => r.valid).length} Contract(s)`}
                    </button>
                </div>

            {:else if csvStep === 'result'}
                <h3>Import Result</h3>

                <div class="csv-result-display">
                    {#if csvResultType === 'success'}
                        <div class="csv-result-icon csv-result-success">✓</div>
                    {:else}
                        <div class="csv-result-icon csv-result-fail">✗</div>
                    {/if}
                    <p class="csv-result-message">{csvResult}</p>
                    {#if csvRolledBack}
                        <p class="csv-rollback-note">All changes were rolled back successfully.</p>
                    {/if}
                </div>

                <div class="modal-actions">
                    <button class="btn-confirm" onclick={resetCsvModal}>Close</button>
                </div>
            {/if}
        </div>
    </div>
{/if}

{#if showExportModal}
    <div class="modal-overlay" onclick={() => showExportModal = false}>
        <div class="modal-content csv-modal-content" onclick={(e) => e.stopPropagation()}>
            <h3>Export Contract List</h3>
            <p class="csv-help">Choose a format to export the {visibleContracts.length} currently displayed contract(s).</p>
            <div class="export-options">
                <label class="export-option" class:export-option-active={exportFormat === 'csv'}>
                    <input type="radio" name="exportFormat" value="csv" bind:group={exportFormat} />
                    <span class="export-option-label">CSV (.csv)</span>
                    <span class="export-option-desc">Comma-separated values, compatible with Excel and Google Sheets</span>
                </label>
                <label class="export-option" class:export-option-active={exportFormat === 'xlsx'}>
                    <input type="radio" name="exportFormat" value="xlsx" bind:group={exportFormat} />
                    <span class="export-option-label">Excel (.xlsx)</span>
                    <span class="export-option-desc">Microsoft Excel workbook format</span>
                </label>
            </div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick={() => showExportModal = false}>Cancel</button>
                <button class="btn-confirm" onclick={doExport}>Export</button>
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
        gap: 6px;
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

    .sort-icon {
        opacity: 0;
        transition: opacity 0.15s;
        font-size: 0.7rem;
    }

    .sortable-th:hover .sort-icon {
        opacity: 1;
    }

    .select-all-option {
        font-weight: 700;
        color: #7B1113;
        border-bottom: none;
    }

    .select-all-divider {
        height: 1px;
        background-color: #e5e7eb;
        margin: 4px 0;
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
        text-align: center;
    }

    .th-checkbox, .td-checkbox { width: 48px; text-align: center; }
    .td-title { text-align: left; }
    .th-checkbox input, .td-checkbox input { width: 18px; height: 18px; cursor: pointer; accent-color: #7B1113; }


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
        background-color: #e8a317; color: white;
    }
    .csv-btn:hover { background-color: #c48b12; }

    .export-btn {
        background-color: #1a73e8; color: white;
    }
    .export-btn:hover { background-color: #1557b0; }

    .csv-modal-content { width: 700px; max-width: 95vw; max-height: 90vh; overflow-y: auto; text-align: left; }
    .csv-modal-content h3 { text-align: center; margin-bottom: 12px; }
    .csv-modal-content h4 { font-size: 0.95rem; color: #374151; margin: 16px 0 6px; }

    .csv-attachment-section { margin-bottom: 12px; }
    .csv-attachment-label { border-color: #93c5fd !important; }
    .csv-file-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; }
    .csv-file-item { display: flex; justify-content: space-between; align-items: center; background: #f3f4f6; padding: 6px 10px; border-radius: 6px; font-size: 0.85rem; }
    .csv-file-remove { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: #dc2626; padding: 0 4px; }
    .csv-file-remove:hover { color: #b91c1c; }

    .csv-preview-table-wrap { max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; margin: 12px 0; }
    .csv-preview-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .csv-preview-table th { background: #7B1113; color: white; padding: 8px 10px; font-size: 0.8rem; position: sticky; top: 0; }
    .csv-preview-table td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; }
    .csv-preview-table tbody tr:hover { background: #f9fafb; }
    .csv-row-invalid { background: #fef2f2; }
    .csv-row-valid { background: #ffffff; }

    .csv-preview-errors { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin: 8px 0; font-size: 0.85rem; color: #b91c1c; }
    .csv-error-row { margin: 4px 0; }

    .csv-summary { text-align: center; font-size: 0.85rem; color: #6b7280; padding: 8px; background: #f9fafb; border-radius: 8px; margin: 8px 0; }

    .csv-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }
    .csv-badge-ok { background: #d1fae5; color: #065f46; }
    .csv-badge-err { background: #fef2f2; color: #b91c1c; cursor: help; }

    .csv-result-display { text-align: center; padding: 20px 0; }
    .csv-result-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 1.4rem; font-weight: bold; }
    .csv-result-success { background: #d1fae5; color: #065f46; }
    .csv-result-fail { background: #fef2f2; color: #b91c1c; }
    .csv-result-message { font-size: 0.95rem; color: #374151; margin-bottom: 8px; }
    .csv-rollback-note { font-size: 0.85rem; color: #6b7280; font-style: italic; }

    .csv-result { font-size: 0.9rem; padding: 8px; border-radius: 6px; margin: 8px 0; }
    .csv-success { color: #035a24; background: #e6f4ea; }
    .csv-error { color: #b91c1c; background: #fef2f2; }

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
    .bulk-manage-access-btn { background-color: white; color: #7B1113; }
    .bulk-manage-access-btn:hover { background-color: #fef2f2; }
    .bulk-manage-access-btn:disabled{ opacity:.5; cursor:not-allowed; }

    .btn-danger {
        background: #dc2626; color: white; border: none;
        padding: 10px 25px; border-radius: 8px; cursor: pointer;
        font-weight: 600; transition: background 0.2s;
    }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }

    .csv-help { font-size: 0.9rem; color: #6b7280; margin-bottom: 12px; line-height: 1.5; }
    .csv-upload-zone { margin-bottom: 12px; }
    .csv-input { display: none; }
    .csv-label {
        display: block; padding: 12px; border: 2px dashed #d1d5db;
        border-radius: 8px; text-align: center; cursor: pointer;
        color: #4b5563; font-size: 0.9rem; transition: border-color 0.2s;
    }
    .csv-label:hover { border-color: #035a24; }

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
    .manage-access-scroll {
        max-height: 70vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .access-modal {
        width: min(1100px, 95vw);
    }

    .draft-title { color: #e67e22; }
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

    .export-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 16px;
    }

    .export-option {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px 16px;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .export-option:hover {
        border-color: #93c5fd;
    }

    .export-option-active {
        border-color: #7B1113;
        background: #fff0f0;
    }

    .export-option input[type="radio"] {
        display: none;
    }

    .export-option-label {
        font-weight: 600;
        font-size: 0.95rem;
        color: #111827;
    }

    .export-option-desc {
        font-size: 0.8rem;
        color: #6b7280;
    }

    .access-modal{
    max-width:900px;
    width:90%;
}

.access-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:20px;
}

.access-footer{
    display:flex;
    justify-content:flex-end;
    margin-top:20px;
}

.btn-done{
    background: #02461C;
    color: white;
    border: none;
    padding: 10px 35px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    transition: background-color 0.2s ease;
}

.btn-done:hover{
    background: #013014;
}

    @media (max-width: 768px) {
        .main-content { padding: 1rem; }
        .page-title { font-size: 1.5rem; }
        .controls { flex-direction: column; align-items: stretch; }
        .search-input { width: 100%; }
        .multi-select-wrap { width: 100%; }
        .multi-select-trigger { width: 100%; }
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