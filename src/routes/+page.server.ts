import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url, locals: { safeGetSession } }) => {
  const { session } = await safeGetSession()

  // if the user is already logged in return them to the account page
  if (session) {
    redirect(303, '/account')
  }

  return { url: url.origin }
}

export const actions: Actions = {
  googleLogin: async ({ locals: { supabase }, url }) => {
    // Call Supabase to get the OAuth authorization URL
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Dynamic redirect URL pointing to our SvelteKit callback route
        redirectTo: `${url.origin}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    // Use SvelteKit's redirect helper to send the user to Google
    if (data.url) {
      throw redirect(303, data.url); 
    }
  }
};