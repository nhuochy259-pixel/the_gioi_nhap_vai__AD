import React, { useState } from 'react';
import { X, PenTool } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { PromptItem } from '../../types';
import toast from 'react-hot-toast';

interface CreatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  promptToEdit?: PromptItem | null;
}

export default function CreatePromptModal({ isOpen, onClose, onSuccess, promptToEdit }: CreatePromptModalProps) {
  const { user } = useAuthStore();

  const [name, setName] = useState(promptToEdit?.title || promptToEdit?.name || '');
  const [purpose, setPurpose] = useState(promptToEdit?.purpose || '');
  const [content, setContent] = useState(promptToEdit?.content || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(promptToEdit?.tags || []);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !user) return null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.length > 30) {
      toast.error("Tên Tag không quá 30 ký tự.");
      return;
    }
    if (tags.length >= 6) {
      toast.error("Tối đa 6 Tag cho một Prompt.");
      return;
    }
    if (tags.includes(trimmed)) {
      toast.error("Tag đã tồn tại.");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Vui lòng nhập tên Prompt.");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Vui lòng nhập mục đích sử dụng Prompt.");
      return;
    }
    if (!content.trim()) {
      toast.error("Vui lòng nhập nội dung Prompt.");
      return;
    }

    setSaving(true);
    try {
      if (promptToEdit) {
        const promptRef = doc(db, 'prompts', promptToEdit.id);
        await updateDoc(promptRef, {
          name: name.trim(),
          purpose: purpose.trim(),
          content: content.trim(),
          tags,
          updatedAt: serverTimestamp()
        });
        toast.success("Cập nhật Prompt thành công!");
      } else {
        const { generateUniqueId } = await import('../../lib/generateId');
        const numericId = await generateUniqueId(db, 'prompt', ''); // Will set objectReference after adding doc, or actually we can just pass '' for now and let the system use numericId. Or wait, addDoc gives us the docId after. We can just generate the numericId first.
        
        await addDoc(collection(db, 'prompts'), {
          numericId,
          authorId: user.id,
          authorName: user.displayName,
          authorAvatar: user.avatar || '',
          name: name.trim(),
          purpose: purpose.trim(),
          content: content.trim(),
          tags,
          pinned: false,
          copyCount: 0,
          savesCount: 0,
          viewsCount: 0,
          createdAt: new Date().toISOString(),
          deletedAt: null
        });
        toast.success("Tạo Prompt mới thành công!");

        // Notify followers of new prompt
        try {
          const followersQuery = query(collection(db, 'follows'), where('targetCreatorId', '==', user.id));
          const followersSnap = await getDocs(followersQuery);
          for (const fDoc of followersSnap.docs) {
            const fData = fDoc.data();
            if (fData.followerId && fData.followerId !== user.id) {
              await addDoc(collection(db, 'notifications'), {
                userId: fData.followerId,
                type: 'NEW_CONTENT',
                title: 'Prompt mới từ Creator bạn follow',
                body: `${user.displayName} đã đăng một Prompt mới: ${name.trim()}`,
                read: false,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (notifErr) {
          console.error("Failed to notify followers about new prompt:", notifErr);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu Prompt: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <PenTool className="w-5 h-5 text-indigo-500" />
            {promptToEdit ? "Chỉnh sửa Prompt" : "Tạo Prompt mới"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-black dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Tên Prompt <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="VD: Prompt tạo nhân vật phản diện quyến rũ" 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Mục đích sử dụng <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={purpose} 
              onChange={e => setPurpose(e.target.value)} 
              placeholder="VD: Dùng cho Roleplay học đường, Xây dựng thế giới, Jailbreak..." 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Nội dung Prompt <span className="text-red-500">*</span>
            </label>
            <textarea 
              rows={6}
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder="Nhập toàn bộ System Instruction / Prompt mà bạn muốn chia sẻ..." 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-mono text-xs"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Tag (Tối đa 6 Tag)
            </label>
            <div className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={tagInput} 
                onChange={e => setTagInput(e.target.value)} 
                placeholder="Thêm tag (VD: roleplay, system)..." 
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
              />
              <button 
                type="button" 
                onClick={handleAddTag} 
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-xl font-medium text-xs hover:bg-neutral-300 dark:hover:bg-neutral-600"
              >
                Thêm
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-xs">
                  #{tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="px-5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : (promptToEdit ? "Lưu thay đổi" : "Tạo Prompt")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
