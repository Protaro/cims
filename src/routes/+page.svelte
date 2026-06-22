<script lang="ts">
	import { redirect } from '@sveltejs/kit';
	import type { Actions } from './$types';
</script>

<div class="login-container">
	<h1 class="title">CIMS Contract Manager</h1>

	<form method="POST" action="?/googleLogin">
		<button type="submit">Login with Google</button>
	</form>
</div>

<style>
	.login-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 70vh; 
		font-family: 'serif'; 
	}

	.title {
		font-size: 3rem;
		font-weight: 400;
		margin-bottom: 2rem;
		color: #000;
	}

	.login-form {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		width: 100%;
		max-width: 600px;
	}

	.input-group {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 1rem;
	}

	.input-group label {
		font-family: sans-serif;
		font-size: 1.25rem;
		width: 100px;
		text-align: left;
	}

	.input-group input {
		flex-grow: 1;
		padding: 0.75rem 1.5rem;
		border-radius: 50px; 
		border: 1px solid #000;
		background-color: #e5e7eb; 
		font-size: 1rem;
		outline: none;
	}

	.login-button {
		margin-top: 1rem;
		padding: 0.5rem 2.5rem;
		background-color: #7a1a1a; 
		color: white;
		text-decoration: none;
		border-radius: 20px;
		font-family: sans-serif;
		font-size: 1.25rem;
		transition: background-color 0.25s;
	}

	.login-button:hover {
		background-color: #5a1313;
	}
</style>