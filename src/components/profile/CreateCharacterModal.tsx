import React, { useState } from 'react';
import { X, Upload, Link as LinkIcon, Sparkles } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { CharacterItem } from '../../types';
import toast from 'react-hot-toast';

interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  characterToEdit?: CharacterItem | null;
}

export default function CreateCharacterModal({ isOpen, onClose, onSuccess, characterToEdit }: CreateCharacterModalProps) {
  const { user } = useAuthStore();

  const [name, setName] = useState(characterToEdit?.name || '');
  const [avatar, setAvatar] = useState(characterToEdit?.avatar || '');
  const [gender, setGender] = useState(characterToEdit?.gender || 'Nữ');
  const [slogan, setSlogan] = useState(characterToEdit?.slogan || '');
  const [plot, setPlot] = useState(characterToEdit?.plot || '');
  const [openingScene, setOpeningScene] = useState(characterToEdit?.openingScene || '');
  const [link, setLink] = useState(characterToEdit?.characterLink || characterToEdit?.link || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(characterToEdit?.tags || []);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !user) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Dung lượng file vượt quá 10MB!");
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Chỉ chấp nhận định dạng JPG, JPEG, PNG, WEBP!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatar(event.target?.result as string);
      toast.success("Tải ảnh nhân vật thành công!");
    };
    reader.readAsDataURL(file);
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.length > 30) {
      toast.error("Tên Tag không quá 30 ký tự.");
      return;
    }
    if (tags.length >= 6) {
      toast.error("Tối đa 6 Tag cho một Character.");
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
      toast.error("Vui lòng nhập tên Character.");
      return;
    }
    if (name.length > 50) {
      toast.error("Tên Character tối đa 50 ký tự.");
      return;
    }
    if (!avatar) {
      toast.error("Vui lòng chọn hoặc tải ảnh Avatar cho Character.");
      return;
    }
    if (!slogan.trim()) {
      toast.error("Vui lòng nhập Slogan.");
      return;
    }
    if (slogan.length > 700) {
      toast.error("Slogan tối đa 700 ký tự.");
      return;
    }
    if (!plot.trim()) {
      toast.error("Vui lòng nhập Cốt truyện / Plot.");
      return;
    }
    if (!link.trim()) {
      toast.error("Vui lòng nhập Link Character từ Google AI Studio.");
      return;
    }

    // Google AI Studio link validation according to Section III of Module 09
    if (!link.includes("aistudio.google.com") && !link.includes("alkalicdn") && !link.includes("google.com")) {
      toast.error("Link Character phải xuất phát từ Google AI Studio (aistudio.google.com).");
      return;
    }

    setSaving(true);
    try {
      if (characterToEdit) {
        const charRef = doc(db, 'characters', characterToEdit.id);
        await updateDoc(charRef, {
          name: name.trim(),
          avatar,
          gender,
          slogan: slogan.trim(),
          plot: plot.trim(),
          openingScene: openingScene.trim(),
          link: link.trim(),
          tags,
          updatedAt: serverTimestamp()
        });
        toast.success("Cập nhật Character thành công!");
      } else {
        const { generateUniqueId } = await import('../../lib/generateId');
        const numericId = await generateUniqueId(db, 'character', '');

        await addDoc(collection(db, 'characters'), {
          numericId,
          creatorId: user.id,
          creatorName: user.displayName,
          creatorAvatar: user.avatar || '',
          name: name.trim(),
          avatar,
          gender,
          slogan: slogan.trim(),
          plot: plot.trim(),
          openingScene: openingScene.trim(),
          link: link.trim(),
          tags,
          pinned: false,
          likesCount: 0,
          savesCount: 0,
          viewsCount: 0,
          createdAt: new Date().toISOString(),
          deletedAt: null
        });
        toast.success("Tạo Character mới thành công!");

        // Notify followers of new character
        try {
          const followersQuery = query(collection(db, 'follows'), where('targetCreatorId', '==', user.id));
          const followersSnap = await getDocs(followersQuery);
          for (const fDoc of followersSnap.docs) {
            const fData = fDoc.data();
            if (fData.followerId && fData.followerId !== user.id) {
              await addDoc(collection(db, 'notifications'), {
                userId: fData.followerId,
                type: 'NEW_CONTENT',
                title: 'Character mới từ Creator bạn follow',
                body: `${user.displayName} đã đăng một Character mới: ${name.trim()}`,
                read: false,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (notifErr) {
          console.error("Failed to notify followers about new character:", notifErr);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu Character: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {characterToEdit ? "Chỉnh sửa Character" : "Tạo Character mới"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-black dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          {/* Avatar upload */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
              Ảnh đại diện Character <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-4">
              {avatar ? (
                <img src={avatar} alt="Character Preview" className="w-20 h-20 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs text-neutral-400">
                  Chưa có ảnh
                </div>
              )}
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-medium rounded-xl cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  Tải ảnh từ thiết bị
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
                </label>
                <p className="text-xs text-neutral-400">Hỗ trợ JPG, PNG, WEBP tối đa 10MB.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Tên Character <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                maxLength={50}
                placeholder="VD: Nguyễn Văn A / Emi" 
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Giới tính <span className="text-red-500">*</span>
              </label>
              <select 
                value={gender} 
                onChange={e => setGender(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              >
                <option value="Nữ">Nữ</option>
                <option value="Nam">Nam</option>
                <option value="Phi giới tính">Phi giới tính / Khác</option>
              </select>
            </div>
          </div>

          {/* Slogan */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Slogan <span className="text-red-500">*</span>
            </label>
            <textarea 
              rows={2}
              value={slogan} 
              onChange={e => setSlogan(e.target.value)} 
              maxLength={700}
              placeholder="Slogan / Lời dẫn ngắn gợi mở tính cách nhân vật (max 700 ký tự)" 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
            />
          </div>

          {/* Plot */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Cốt truyện (Plot) <span className="text-red-500">*</span>
            </label>
            <textarea 
              rows={4}
              value={plot} 
              onChange={e => setPlot(e.target.value)} 
              placeholder="Chi tiết cốt truyện, bối cảnh Roleplay và đặc điểm nhân vật..." 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Opening Scene */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Cảnh mở đầu (Opening Scene)
            </label>
            <textarea 
              rows={3}
              value={openingScene} 
              onChange={e => setOpeningScene(e.target.value)} 
              placeholder="Đoạn mở đầu / Lời thoại khởi đầu cuộc hội thoại Roleplay (tùy chọn)..." 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Link Character Google AI Studio */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Link Character (Google AI Studio) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <LinkIcon className="w-4 h-4 text-neutral-400 shrink-0" />
              <input 
                type="url" 
                value={link} 
                onChange={e => setLink(e.target.value)} 
                placeholder="https://aistudio.google.com/..." 
                className="bg-transparent border-none outline-none w-full"
              />
            </div>
            <p className="text-xs text-neutral-400 mt-1">Bắt buộc phải là liên kết hợp lệ từ Google AI Studio.</p>
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
                placeholder="Thêm tag (VD: modern, romance)..." 
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
              {saving ? "Đang lưu..." : (characterToEdit ? "Lưu thay đổi" : "Tạo Character")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
