import { redirect } from '@sveltejs/kit';
import type {PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession }}) => {
    const {session} = await safeGetSession()
    if (!session) {
        redirect(303, '/')
    }

    const { data : access } = await supabase
    .from('profiles')
    .select(`access_level, id`)
    .eq('id', session.user.id)
    .single()

    return {
        access : access?.access_level,
        userId : access?.id
    }
}