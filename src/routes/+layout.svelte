<script lang="ts">
    import upSeal from '$lib/assets/UP-Seal.png';
    import upseLogo from '$lib/assets/UPSE CMS logo.png'; 
    import { Files, FilePlusCorner, TextSearch, Home } from 'lucide-svelte'; // Imported Home icon

    import { invalidate } from '$app/navigation';
    import { onMount } from 'svelte';
    
    let { data, children } = $props();
    let { supabase, session } = $derived(data);

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

<header class="header-container">
    <div class="logo-section">
        <a href="/account">
            <img src={upseLogo} alt="UPSE CMS Logo" class="logo-img" />
        </a>
    </div>

    <nav class="nav-links">
        <a href="/account" class="nav-link">
            <Home size={18} strokeWidth={2.5} />
            <span>Home</span>
        </a>

        <a href="/workflow" class="nav-link">
            <Files size={18} strokeWidth={2.5} />
            <span>Workflows</span>
        </a>

        <a href="/view" class="nav-link">
            <TextSearch size={18} strokeWidth={2.5} />
            <span>Contracts</span>
        </a>

        <a href="/create-contract" class="nav-link create-btn">
            <FilePlusCorner size={18} strokeWidth={2.5} />
            <span>Create Contract</span>
        </a>
    </nav>
</header>

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

    .create-btn {
        background-color: #02461C;
        color: white;
        font-weight: 600;
        margin-left: 0.5rem;
        box-shadow: 0 2px 4px rgba(2, 70, 28, 0.15);
    }

    .create-btn:hover {
        background-color: #023214;
        color: white;
        box-shadow: 0 4px 6px rgba(2, 70, 28, 0.25);
        transform: translateY(-1px);
    }

    .create-btn:active {
        transform: scale(0.97) translateY(0);
    }
</style>