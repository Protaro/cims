<script lang="ts">
    import upSeal from '$lib/assets/UP-Seal.png';
    import upseLogo from '$lib/assets/UPSE CMS logo.png'; 
    import { Files, TextSearch, Home, LogOut } from 'lucide-svelte';

    import { invalidate, goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    
    let { data, children } = $props();
    let { supabase, session } = $derived(data);
    let currentPath = $derived($page.url.pathname);

    async function handleSignOut() {
        await supabase.auth.signOut();
        goto('/');
    }

    onMount(() => {
        const { data } = supabase.auth.onAuthStateChange((event, _session) => {
            if (_session?.expires_at !== session?.expires_at) {
                invalidate('supabase:auth');
            }
        });
        return () => data.subscription.unsubscribe();
    });
</script>

<svelte:head>
    <title>UPSE Contracts Management System</title>
    <link rel="icon" href={upSeal} />
</svelte:head>

{#if session}
<header class="header-container">
    <div class="logo-section">
        <a href="/account">
            <img src={upseLogo} alt="UPSE CMS Logo" class="logo-img" />
        </a>
    </div>

    <nav class="nav-links">
        <a href="/account" class="nav-link" class:active={currentPath === '/account'}>
            <Home size={18} strokeWidth={2.5} />
            <span>Home</span>
        </a>

        <a href="/workflow" class="nav-link" class:active={currentPath.startsWith('/workflow')}>
            <Files size={18} strokeWidth={2.5} />
            <span>Workflows</span>
        </a>

        <a href="/view" class="nav-link" class:active={currentPath.startsWith('/view') || currentPath.startsWith('/create-contract') || currentPath.startsWith('/edit-contract')}>
            <TextSearch size={18} strokeWidth={2.5} />
            <span>Contracts</span>
        </a>

        <button class="nav-link signout-btn" onclick={handleSignOut}>
            <LogOut size={18} strokeWidth={2.5} />
            <span>Sign Out</span>
        </button>
    </nav>
</header>
{/if}

<main>
    {@render children()}
</main>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

    :global(body) {
        font-family: 'Poppins', sans-serif;
        margin: 0;
        background-color: #f9fafb;
    }

    .header-container {
        display: flex;
        align-items: center; 
        justify-content: space-between;
        padding: 0.75rem 2.5rem;
        background-color: white;
        border-bottom: 1px solid #e5e7eb;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        position: sticky;
        top: 0;
        z-index: 50;
        gap: 1rem;
    }

    .logo-img {
        height: 60px;
        width: auto;
        display: block;
    }

    .nav-links {
        display: flex;
        flex-direction: row;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
    }

    @media (max-width: 768px) {
        .header-container { padding: 0.5rem 1rem; }
        .logo-img { height: 40px; }
        .nav-links { gap: 0.25rem; }
        .nav-link { padding: 6px 10px; font-size: 0.85rem; }
    }

    @media (max-width: 480px) {
        .header-container { flex-direction: column; gap: 0.5rem; }
        .nav-links { width: 100%; justify-content: center; }
    }

    .nav-link {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        color: #4b5563; 
        text-decoration: none;
        font-weight: 500;
        font-size: 0.95rem; 
        border-radius: 8px;
        transition: all 0.2s ease;
    }

    .nav-link:hover {
        color: #7B1113;
        background-color: #fff0f0;
    }

    .nav-link:active {
        transform: scale(0.97);
    }

    .nav-link.active {
        color: #7B1113;
        background-color: #fff0f0;
        font-weight: 600;
    }

    .signout-btn {
        background: none;
        border: 1px solid #e5e7eb;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
        margin-left: auto;
    }

    .signout-btn:hover {
        color: #7B1113;
        background-color: #fff0f0;
        border-color: #fecaca;
    }
</style>