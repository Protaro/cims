import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession()
  if (!session) {
    redirect(303, '/')
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select(`username, full_name, access_level, user_group`)
    .eq('id', session.user.id)
    .single()

  const {data: users} = await supabase
    .from('profiles')
    .select(`id, username, full_name, access_level, user_group`)
    .order('username')

  const { data : user_groups} = await supabase
    .from('user_groups')
    .select(`id, group_name`)

  return { session, profile, users, user_groups }
}
export const actions: Actions = {
  update: async ({ request, locals: { supabase, safeGetSession } }) => {
    const formData = await request.formData()
    const fullName = formData.get('fullName') as string
    const username = formData.get('username') as string
    const { session } = await safeGetSession()
    const { error } = await supabase.from('profiles').upsert({
      id: session?.user.id,
      full_name: fullName,
      username,
      updated_at: new Date(),
    })
    if (error) {
      return fail(500, {
        fullName,
        username,
      })
    }
    return {
      fullName,
      username,
    }
  },
  update_access_level: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { session  } = await safeGetSession()
    //const { data: profile, error: profileError } = await supabase
    //  .from('profiles')
    //  .select('access_level')
    //  .eq('id', session?.user.id)
    //  .single()

    //if (profileError || profile?.access_level !== 'Workflow Manager') {
    //  console.log("AAAAAAAAAA")
    //  return fail(403, { message: 'Unauthorized' })
    //}

    const formData = await request.formData()
    const id = formData.get('id') as string
    const access_level = formData.get('access_level') as string

    const { error } = await supabase.from('profiles').update({
      access_level,
      updated_at: new Date(),
    }).eq('id', id)
    if (error) {
      return fail(500, {
        id: id,
        access_level: access_level,
      })
    }
    return {
      id: id,
      access_level: access_level,
    }
  },
  update_user_group: async ({request, locals: {supabase, safeGetSession}}) => {
    const formData = await request.formData()
    const id = formData.get('id') as string
    const user_group = formData.get('user_group')
    
    const { error } = await supabase.from('profiles').update( {
      updated_at: new Date(),
      user_group,
    }).eq('id', id)
    if(error) {
      return fail(500, {
        id: id,
        user_group: user_group,
      })
    }
    return {
      id: id,
      user_group: user_group,
    }
  }
}