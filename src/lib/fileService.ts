import { supabase } from '$lib/supabaseInit';

export async function uploadFiles(stageId: string, files: File[]) {
    let urls: string[] = [];

    for (const file of files) {
        const path = `${stageId}/${Date.now()}-${file.name}`;

        const { error } = await supabase.storage
            .from('stage-files')
            .upload(path, file);

        if (error) throw error;

        // Try signed URL first (works for both public and private buckets)
        const { data: signed } = await supabase.storage
            .from('stage-files')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years

        if (signed?.signedUrl) {
            urls.push(signed.signedUrl);
        } else {
            // Fallback: public URL (only works if bucket is public)
            const { data } = supabase.storage
                .from('stage-files')
                .getPublicUrl(path);
            urls.push(data.publicUrl);
        }
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

function extractPathFromUrl(fileUrl: string): string | null {
    // Handles both public URLs and signed URLs
    // Public: /storage/v1/object/public/stage-files/{path}
    // Signed: /storage/v1/object/sign/stage-files/{path}?token=...
    try {
        const url = new URL(fileUrl);
        const segments = url.pathname.split('/storage/v1/object/');
        if (segments.length < 2) return null;
        const afterObject = segments[1];
        const pathStart = afterObject.indexOf('stage-files/');
        if (pathStart === -1) return null;
        return afterObject.slice(pathStart + 'stage-files/'.length);
    } catch {
        return null;
    }
}

export async function deleteFile(stageType: string, stageId: string, fileUrl: string) {
    const path = extractPathFromUrl(fileUrl);

    if (path) {
        await supabase.storage.from('stage-files').remove([path]);
    }

    await supabase
        .from('stage_files')
        .delete()
        .eq('stage_type', stageType)
        .eq('stage_id', stageId)
        .eq('file_url', fileUrl);
}
