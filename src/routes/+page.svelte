<script lang="ts">
	import upSeal from '$lib/assets/UP-Seal.png';
</script>

<div class="page">
	<div class="bg-overlay"></div>
	<div class="card">
		<img src={upSeal} alt="UP Seal" class="seal" />
		<h1 class="title">CIMS</h1>
		<p class="subtitle">Contract Management System</p>
		<div class="divider"></div>

		<form method="POST" action="?/googleLogin">
			<button type="submit" class="google-btn">
				<svg class="google-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
					<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
					<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
					<path fill="#FBBC05" d="M10.54 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.56l7.98-5.97z"/>
					<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"/>
					<path fill="none" d="M0 0h48v48H0z"/>
				</svg>
				<span>Sign in with Google</span>
			</button>
		</form>

		<p class="footer-text">Access the UPSE Contracts Management System</p>
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: linear-gradient(135deg, #7B1113 0%, #5a0a0e 50%, #3d0609 100%);
		position: relative;
		overflow: hidden;
	}

	.bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 50%, rgba(255, 255, 255, 0.04) 0%, transparent 60%),
			radial-gradient(ellipse at 80% 50%, rgba(255, 255, 255, 0.03) 0%, transparent 60%);
		pointer-events: none;
	}

	.card {
		background: white;
		border-radius: 24px;
		padding: 3rem 3.5rem;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.3),
			0 0 0 1px rgba(255, 255, 255, 0.05);
		text-align: center;
		max-width: 420px;
		width: 90%;
		position: relative;
		z-index: 1;
		animation: fadeUp 0.6s ease-out;
	}

	@keyframes fadeUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.seal {
		width: 80px;
		height: auto;
		margin-bottom: 1.25rem;
	}

	.title {
		font-family: 'Poppins', sans-serif;
		font-size: 2.5rem;
		font-weight: 700;
		color: #1a1a1a;
		margin: 0;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-family: 'Poppins', sans-serif;
		font-size: 1rem;
		font-weight: 400;
		color: #6b7280;
		margin: 0.25rem 0 0 0;
	}

	.divider {
		width: 50px;
		height: 3px;
		background: linear-gradient(90deg, #7B1113, #b91c1c);
		border-radius: 2px;
		margin: 1.5rem auto;
	}

	.google-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		width: 100%;
		padding: 14px 24px;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 12px;
		font-family: 'Poppins', sans-serif;
		font-size: 1rem;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.google-btn:hover {
		background: #f9fafb;
		border-color: #9ca3af;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
		transform: translateY(-1px);
	}

	.google-btn:active {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.google-icon {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.footer-text {
		font-family: 'Poppins', sans-serif;
		font-size: 0.8rem;
		color: #9ca3af;
		margin: 1.5rem 0 0 0;
	}
</style>