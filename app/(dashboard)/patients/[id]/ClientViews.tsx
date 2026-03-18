'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Folder, FileText, Plus, Trash2, Download, ArrowLeft, UploadCloud } from 'lucide-react';
import { deleteFile, uploadFileAction, createFolder, deleteFolder, addNote, deleteNote, getSignedUrl } from './actions';
import type { PatientFile, AppointmentNote, Folder as FolderType } from '@/types';

type DetailProps = {
  patientId: string;
  currentFolderId: string | null;
  folders: FolderType[];
  files: PatientFile[];
  notes: AppointmentNote[];
  permissions: 'view' | 'edit';
};

export function PatientDetailViews({ patientId, currentFolderId, folders, files, notes, permissions }: DetailProps) {
  return (
    <Tabs value="files" className="w-full">
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
        />
      </TabsContent>

      <TabsContent value="notes" className="space-y-4">
        <NotesView 
          patientId={patientId} 
          notes={notes} 
          permissions={permissions} 
        />
      </TabsContent>
    </Tabs>
  );
}

// ------------------------------------------------------------------------------------------
// FILES VIEW
// ------------------------------------------------------------------------------------------
function FilesView({ patientId, currentFolderId, folders, files, permissions }: Omit<DetailProps, 'notes'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isUploading, setIsUploading] = useState(false);
  const [isFolderCreating, setIsFolderCreating] = useState(false);
  const [folderName, setFolderName] = useState('');

  const navigateToFolder = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
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
    
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const res = await uploadFileAction(patientId, currentFolderId, formData);
    setIsUploading(false);

    if (!res.error) {
      // close dialog via uncontrolled DOM or state (kept simple here, would need fully controlled state ideally)
      alert('Upload successful');
    } else {
      alert(res.error);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permissions === 'view' || !folderName.trim()) return;

    setIsFolderCreating(true);
    const res = await createFolder({ patientId, name: folderName, parentId: currentFolderId });
    setIsFolderCreating(false);

    if (!res.error) {
      setFolderName('');
    } else {
      alert(res.error);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    await deleteFile(id, patientId);
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this folder? All contents will be lost.')) return;
    await deleteFolder(id, patientId);
  };

  const handleDownload = async (id: string, name: string) => {
    const { data: url } = await getSignedUrl(id);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name; // mostly ignored for cross-origin, but signed URLs often map attachments
      a.target = '_blank';
      a.click();
    }
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
            placeholder="Search files or tags..." 
            className="w-full sm:w-64 max-w-sm h-8 !mt-0 ml-0 sm:ml-4" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {permissions === 'edit' && (
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <Plus className="w-4 h-4 mr-2" /> New Folder
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Folder</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateFolder} className="space-y-4 pt-4">
                  <Input 
                    placeholder="Folder Name" 
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

            <Dialog>
              <DialogTrigger render={<Button size="sm" className="bg-blue-800 text-white hover:bg-blue-900" />}>
                <UploadCloud className="w-4 h-4 mr-2" /> Upload File
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Upload File</DialogTitle></DialogHeader>
                <form onSubmit={handleUpload} className="space-y-4 pt-4">
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
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteFolder(folder.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(file.id, file.fileName)} className="text-gray-600 hover:text-blue-800 hover:bg-blue-50">
                      <Download className="w-4 h-4" />
                    </Button>
                    {permissions === 'edit' && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(file.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------
// NOTES VIEW
// ------------------------------------------------------------------------------------------
function NotesView({ patientId, notes, permissions }: Omit<DetailProps, 'currentFolderId' | 'folders' | 'files'>) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (permissions === 'view' || !content.trim()) return;

    setIsSubmitting(true);
    const res = await addNote({ patientId, content });
    setIsSubmitting(false);

    if (!res.error) {
      setContent('');
    } else {
      alert(res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await deleteNote(id, patientId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Appointment History</h3>
        
        {notes.length === 0 ? (
          <EmptyState 
            icon={FileText} 
            title="No notes yet" 
            description="Keep track of appointment summaries, prescriptions, and observations here." 
          />
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <div key={note.id} className="p-4 rounded-lg border bg-white shadow-sm hover:border-blue-200 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-gray-500 tracking-wider">
                    {new Date(note.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  {permissions === 'edit' && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(note.id)} className="opacity-0 group-hover:opacity-100 text-red-500 h-6 px-2">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {permissions === 'edit' && (
        <div className="bg-gray-50 p-4 rounded-lg border h-fit sticky top-24">
          <h3 className="font-medium text-gray-900 mb-3">Add New Note</h3>
          <form onSubmit={handleAddNote} className="space-y-3">
            <Textarea 
              className="resize-none min-h-[120px] text-sm" 
              placeholder="e.g. Patient presents with mild headache. Prescribed..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white">
              {isSubmitting ? 'Saving...' : 'Save Note'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
