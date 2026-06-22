import { supabase } from '$lib/supabaseInit';

export async function uploadFiles(stageId: string, files: File[]) {
    let urls: string[] = [];

    for (const file of files) {
        const path = `${stageId}/${Date.now()}-${file.name}`;

        const { error } = await supabase.storage
            .from('stage-files')
            .upload(path, file);

        if (error) throw error;

        const { data } = supabase.storage
            .from('stage-files')
            .getPublicUrl(path);

        urls.push(data.publicUrl);
    }

    return urls;
}

export async function saveFileRecords(stageType: string, stageId: string, urls: string[]) {
    const inserts = urls.map(url => ({
        stage_type: stageType,
        stage_id: stageId,
        file_url: url
    }));

    const { error } = await supabase
        .from('stage_files')
        .insert(inserts);

    if (error) throw error;
}

export async function loadFiles(stageType: string, stageId: string) {
    const { data, error } = await supabase
        .from('stage_files')
        .select('file_url')
        .eq('stage_type', stageType)
        .eq('stage_id', stageId);

    if (error) throw error;

    return data.map(f => f.file_url);
}

export async function deleteFile(stageType: string, stageId: string, fileUrl: string) {
    const path = new URL(fileUrl).pathname.split('/storage/v1/object/public/stage-files/')[1];

    await supabase.storage.from('stage-files').remove([path]);

    await supabase
        .from('stage_files')
        .delete()
        .eq('stage_type', stageType)
        .eq('stage_id', stageId)
        .eq('file_url', fileUrl);
}