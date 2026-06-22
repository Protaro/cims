import { createClient, type Provider } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

export const supabase = createClient(
	PUBLIC_SUPABASE_URL,
	PUBLIC_SUPABASE_PUBLISHABLE_KEY
);


// PKCE flow for SSR with Supabase Auth yup (modified so it doesnt run every time the file is imported)
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `http://localhost:5173/auth/callback`,
        },
    });
    
    if (error) console.error('Login error:', error.message);
}