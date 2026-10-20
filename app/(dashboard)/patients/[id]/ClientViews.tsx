'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Folder, FileText, Plus, Trash2, Download, ArrowLeft, UploadCloud } from 'lucide-react';
import { deleteFile, createFolder, deleteFolder, getSignedUrl } from './actions';
import { uploadPatientDocument } from '@/lib/uploads/client';
import type { PatientFile, AppointmentNote, Folder as FolderType } from '@/types';
import { FileEdit,FolderRename } from './FileControls';
import { NotesView } from './NotesView';
import { ConfirmAction } from '@/components/ui/confirm-action';

type DetailProps = {
  patientId: string;
  currentFolderId: string | null;
  folders: FolderType[];
  files: PatientFile[];
  notes: AppointmentNote[];
  permissions: 'view' | 'edit';
  filePage?:number;
  folderPage?:number;
  moreFiles?:boolean;
  moreFolders?:boolean;
  loadError?:string | null;
  currentUserId?:string;
  canWriteNotes?:boolean;
  notesPage?:number;
  notesTotalPages?:number;
  notesError?:string | null;
};

export function PatientDetailViews({ patientId, currentFolderId, folders, files, notes, permissions,...paging }: DetailProps) {
  const query=useSearchParams();
  return (
    <Tabs defaultValue={query.get('tab')==='notes' ? 'notes':'files'} className="w-full">
      <TabsList className="mb-6 border-b border-gray-200 bg-transparent gap-6 pb-2" variant="line">
        <TabsTrigger value="files" className="text-base px-2">Files & Folders</TabsTrigger>
        <TabsTrigger value="notes" className="text-base px-2">Appointment Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="files" className="space-y-4">
        <FilesView 
          patientId={patientId} 
          currentFolderId={currentFolderId} 
          folders={folders} 
          files={files} 
          permissions={permissions} 
          {...paging}
        />
      </TabsContent>

      <TabsContent value="notes" className="space-y-4">
        <NotesView 
          patientId={patientId} 
          notes={notes} 
          permissions={permissions} 
          {...paging}
        />
      </TabsContent>
    </Tabs>
  );
}

// ------------------------------------------------------------------------------------------
// FILES VIEW
// ------------------------------------------------------------------------------------------
function FilesView({ patientId, currentFolderId, folders, files, permissions,filePage=1,folderPage=1,moreFiles=false,moreFolders=false,loadError }: Omit<DetailProps, 'notes'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isUploading, setIsUploading] = useState(false);
  const [isFolderCreating, setIsFolderCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [uploadError,setUploadError]=useState<string | null>(null);
  const [uploadNotice,setUploadNotice]=useState<string | null>(null);
  const [isFolderOpen,setIsFolderOpen]=useState(false);
  const [isUploadOpen,setIsUploadOpen]=useState(false);
  const [folderError,setFolderError]=useState<string | null>(null);

  const navigateToFolder = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('filePage');params.delete('folderPage');
    if (id) {
      params.set('folderId', id);
    } else {
      params.delete('folderId');
    }
    router.push(`?${params.toString()}`);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permissions === 'view') return;
    
    setIsUploading(true);setUploadError(null);setUploadNotice(null);
    const formData = new FormData(e.currentTarget);
    const file=formData.get('file');
    if(!(file instanceof File)) { setUploadError('Choose a file to upload');setIsUploading(false);return; }
    const tags=String(formData.get('tags') ?? '').split(',').map(tag=>tag.trim()).filter(Boolean);
    const res = await uploadPatientDocument(patientId,currentFolderId,file,tags);
    setIsUploading(false);

    if (!res.error) {
      setUploadNotice('Upload successful');setIsUploadOpen(false);router.refresh();
    } else {
      setUploadError(res.error);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permissions === 'view' || !folderName.trim()) return;

    setIsFolderCreating(true);setFolderError(null);
    try {
      const res = await createFolder({ patientId, name: folderName, parentId: currentFolderId });
      if (!res.error) { setFolderName('');setIsFolderOpen(false);router.refresh(); } else setFolderError(res.error);
    } catch { setFolderError('Could not create folder. Please retry.'); }
    finally { setIsFolderCreating(false); }
  };


  const handleDownload = async (id: string, name: string) => {
    try {
    const { data: url,error } = await getSignedUrl(id);
    if(error) setUploadError(error);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name; // mostly ignored for cross-origin, but signed URLs often map attachments
      a.target = '_blank';
      a.click();
    }
    } catch { setUploadError('Download failed. Please retry.'); }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const displayedFiles = files.filter(f => 
    !searchQuery || 
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const displayedFolders = folders.filter(f => 
    !searchQuery || 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <div className="space-y-4">
      {uploadError && !isUploadOpen && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
      {loadError && <p role="alert" className="text-sm text-destructive">{loadError} Reload to retry.</p>}
      {uploadNotice && <p role="status" className="text-sm text-muted-foreground">{uploadNotice}</p>}
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-4 rounded-lg border">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {currentFolderId && (
            <Button variant="outline" size="sm" onClick={() => navigateToFolder(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Root
            </Button>
          )}
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:inline-block">
            {currentFolderId ? 'Subfolder View' : 'Root Directory'}
          </span>
          <Input 
            placeholder="Filter this page by name or tags..." aria-label="Filter this page"
            className="w-full sm:w-64 max-w-sm h-8 !mt-0 ml-0 sm:ml-4" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {permissions === 'edit' && (
          <div className="flex gap-2">
            <Dialog open={isFolderOpen} onOpenChange={open=>{setIsFolderOpen(open);setFolderError(null);}}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <Plus className="w-4 h-4 mr-2" /> New Folder
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Folder</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateFolder} className="space-y-4 pt-4">
                  {folderError && <p role="alert" className="text-sm text-destructive">{folderError}</p>}
                  <Input 
                    placeholder="Folder Name" aria-label="Folder name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    required
                  />
                  <Button type="submit" disabled={isFolderCreating} className="w-full bg-blue-800 text-white">
                    {isFolderCreating ? 'Creating...' : 'Create Folder'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isUploadOpen} onOpenChange={open=>{setIsUploadOpen(open);setUploadError(null);setUploadNotice(null);}}>
              <DialogTrigger render={<Button size="sm" className="bg-blue-800 text-white hover:bg-blue-900" />}>
                <UploadCloud className="w-4 h-4 mr-2" /> Upload File
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Upload File</DialogTitle></DialogHeader>
                <form onSubmit={handleUpload} className="space-y-4 pt-4">
                  {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
                  <div className="space-y-2">
                    <Label htmlFor="file">Select File</Label>
                    <Input id="file" name="file" type="file" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input id="tags" name="tags" placeholder="lab, urgent, blood" />
                  </div>
                  <Button type="submit" disabled={isUploading} className="w-full bg-blue-800 text-white">
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState 
          icon={Folder} 
          title="No files or folders" 
          description="This directory is empty. Upload a file or create a folder to get started." 
        />
      ) : (
        <div className="border rounded-md overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedFolders.map(folder => (
                <TableRow key={folder.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium cursor-pointer" onClick={() => navigateToFolder(folder.id)}>
                    <div className="flex items-center text-blue-800">
                      <Folder className="w-4 h-4 mr-2" /> {folder.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500">Folder</TableCell>
                  <TableCell className="text-gray-500">-</TableCell>
                  <TableCell className="text-gray-500">{new Date(folder.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {permissions === 'edit' && (
                      <FolderRename folder={folder} />
                    )}
                    {permissions === 'edit' && (
                      <ConfirmAction triggerLabel={`Delete folder ${folder.name}`} title="Delete this folder?" description="Delete this folder and its subfolders. Files are preserved and moved to the patient root directory." variant="ghost" size="sm" className="text-destructive" onConfirm={()=>deleteFolder(folder.id,patientId)} onSuccess={()=>router.refresh()}>
                        <Trash2 className="w-4 h-4" />
                      </ConfirmAction>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {displayedFiles.map(file => (
                <TableRow key={file.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-gray-400" /> {file.fileName}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500 text-xs truncate max-w-[100px]">{file.mimeType}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{(file.sizeBytes / 1024).toFixed(1)} KB</TableCell>
                  <TableCell className="text-gray-500 text-sm">{new Date(file.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button aria-label={`Download ${file.fileName}`} variant="ghost" size="sm" onClick={() => handleDownload(file.id, file.fileName)} className="text-gray-600 hover:text-blue-800 hover:bg-blue-50">
                      <Download className="w-4 h-4" />
                    </Button>
                    {permissions === 'edit' && (
                      <FileEdit file={file} folders={folders} />
                    )}
                    {permissions === 'edit' && (
                      <ConfirmAction triggerLabel={`Delete file ${file.fileName}`} title="Delete this file?" description="The file will no longer be accessible. Permanent Storage removal is retried automatically if necessary." variant="ghost" size="sm" className="text-destructive" onConfirm={()=>deleteFile(file.id,patientId)} onSuccess={()=>router.refresh()}>
                        <Trash2 className="w-4 h-4" />
                      </ConfirmAction>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex flex-wrap gap-6">
        {([['filePage','Files',filePage,moreFiles],['folderPage','Folders',folderPage,moreFolders]] as const).map(([key,label,page,more])=><nav aria-label={`${label} pages`} key={key} className="flex items-center gap-2"><Button variant="outline" disabled={page<=1} onClick={()=>{ const params=new URLSearchParams(searchParams.toString());params.set(key,String(page-1));router.push(`?${params}`); }}>Previous {label.toLowerCase()}</Button><span className="text-sm">{label} page {page}</span><Button variant="outline" disabled={!more} onClick={()=>{ const params=new URLSearchParams(searchParams.toString());params.set(key,String(page+1));router.push(`?${params}`); }}>Next {label.toLowerCase()}</Button></nav>)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------
