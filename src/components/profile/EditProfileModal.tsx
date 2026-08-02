import React, { useState, useEffect } from 'react';
import { X, Upload, Send, CheckCircle2, Clock, Sparkles, Facebook, Instagram, Music, MessageSquare } from 'lucide-react';
import { doc, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function EditProfileModal({ isOpen, onClose, onSaveSuccess }: EditProfileModalProps) {
  const { user, setAuth, firebaseUser } = useAuthStore();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [facebook, setFacebook] = useState(user?.socialLinks?.facebook || '');
  const [instagram, setInstagram] = useState(user?.socialLinks?.instagram || '');
  const [tiktok, setTiktok] = useState(user?.socialLinks?.tiktok || '');
  const [discord, setDiscord] = useState(user?.socialLinks?.discord || '');
  
  // Creator Request state
  const [requestStatus, setRequestStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED'>('IDLE');
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      setDisplayName(user.displayName || '');
      setAvatar(user.avatar || '');
      setBio(user.bio || '');
      setFacebook(user.socialLinks?.facebook || '');
      setInstagram(user.socialLinks?.instagram || '');
      setTiktok(user.socialLinks?.tiktok || '');
      setDiscord(user.socialLinks?.discord || '');

      // Check existing creator request in Firestore
      const checkRequest = async () => {
        try {
          const reqRef = doc(db, 'creator_requests', user.id);
          const reqSnap = await getDoc(reqRef);
          if (reqSnap.exists()) {
            const data = reqSnap.data();
            setRequestStatus(data.status || 'IDLE');
            if (data.reason) setRequestReason(data.reason);
          } else if (user.creatorRequestStatus) {
            setRequestStatus(user.creatorRequestStatus);
          } else {
            setRequestStatus('IDLE');
          }
        } catch (e) {
          console.error("Error fetching creator request:", e);
        }
      };
      checkRequest();
    }
  }, [isOpen, user]);

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
      const base64Str = event.target?.result as string;
      setAvatar(base64Str);
      toast.success("Tải ảnh đại diện thành công!");
    };
    reader.readAsDataURL(file);
  };

  const handleSendCreatorRequest = async () => {
    if (!user?.id) return;
    setSubmittingRequest(true);
    try {
      const reqData = {
        userId: user.id,
        userDisplayName: displayName.trim() || user.displayName,
        userAvatar: avatar || user.avatar || '',
        userEmail: user.email || '',
        userRole: user.role || 'USER',
        reason: requestReason.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'creator_requests', user.id), reqData);
      await updateDoc(doc(db, 'users', user.id), { creatorRequestStatus: 'PENDING' });

      setRequestStatus('PENDING');
      toast.success("Đã gửi yêu cầu trở thành Creator tới Quản trị viên (Admin)!");
    } catch (err: any) {
      console.error(err);
      toast.error("Gửi yêu cầu thất bại: " + (err.message || "Lỗi không xác định"));
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Vui lòng nhập tên hiển thị.");
      return;
    }
    if (displayName.length > 50) {
      toast.error("Tên hiển thị tối đa 50 ký tự.");
      return;
    }
    if (bio.length > 600) {
      toast.error("Bio tối đa 600 ký tự.");
      return;
    }

    setSaving(true);
    try {
      const updatedData = {
        displayName: displayName.trim(),
        avatar,
        bio: bio.trim(),
        socialLinks: {
          facebook: facebook.trim(),
          instagram: instagram.trim(),
          tiktok: tiktok.trim(),
          discord: discord.trim(),
        },
        updatedAt: new Date().toISOString()
      };

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, updatedData);

      // Update local state
      setAuth(firebaseUser, { ...user, ...updatedData });

      toast.success("Cập nhật hồ sơ thành công!");
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể cập nhật hồ sơ: " + (err.message || "Lỗi không xác định"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-lg font-bold">Chỉnh sửa hồ sơ</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-black dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <img 
                src={avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + displayName} 
                alt="Avatar" 
                className="w-24 h-24 rounded-full object-cover border-2 border-neutral-300 dark:border-neutral-700 shadow-md" 
              />
              <label htmlFor="avatar-upload" className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-xs font-medium rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Upload className="w-5 h-5 mb-1" />
                Tải ảnh lên
              </label>
              <input 
                id="avatar-upload" 
                type="file" 
                accept="image/jpeg,image/jpg,image/png,image/webp" 
                onChange={handleAvatarUpload} 
                className="hidden" 
              />
            </div>
            <p className="text-xs text-neutral-500">Tải lên từ thiết bị (JPG, PNG, WEBP max 10MB)</p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Tên hiển thị <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              maxLength={50}
              placeholder="Nhập tên hiển thị" 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm"
            />
            <div className="text-right text-xs text-neutral-400 mt-1">{displayName.length}/50</div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Bio / Giới thiệu bản thân
            </label>
            <textarea 
              rows={3}
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              maxLength={600}
              placeholder="Viết một chút về bản thân bạn..." 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm resize-none"
            />
            <div className="text-right text-xs text-neutral-400 mt-1">{bio.length}/600</div>
          </div>

          {/* Creator Approval Request Section */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <div className="font-semibold text-sm">Trạng thái Creator</div>
            </div>

            {user.creatorStatus ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Bạn đã là Creator chính thức (Quản trị viên đã phê duyệt). Bạn có thể đăng Character lên hệ thống!</span>
              </div>
            ) : requestStatus === 'PENDING' ? (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                <Clock className="w-4 h-4 shrink-0 animate-spin" />
                <span>Yêu cầu trở thành Creator đã được gửi. Đang chờ Quản trị viên (Admin) xét duyệt.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">
                  Để trở thành Creator (có quyền đăng Character), người dùng cần gửi yêu cầu cho Quản trị viên phê duyệt theo quy định hệ thống.
                </p>
                <div>
                  <textarea
                    rows={2}
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Lý do hoặc mong muốn trở thành Creator (không bắt buộc)..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCreatorRequest}
                  disabled={submittingRequest}
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submittingRequest ? "Đang gửi yêu cầu..." : "Gửi yêu cầu trở thành Creator cho Quản trị viên"}
                </button>
              </div>
            )}
          </div>

          {/* Social Links */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
              Liên kết mạng xã hội
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
                <input 
                  type="url" 
                  value={facebook} 
                  onChange={e => setFacebook(e.target.value)} 
                  placeholder="https://facebook.com/username" 
                  className="bg-transparent border-none outline-none text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                <input 
                  type="url" 
                  value={instagram} 
                  onChange={e => setInstagram(e.target.value)} 
                  placeholder="https://instagram.com/username" 
                  className="bg-transparent border-none outline-none text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <Music className="w-4 h-4 text-neutral-800 dark:text-white shrink-0" />
                <input 
                  type="url" 
                  value={tiktok} 
                  onChange={e => setTiktok(e.target.value)} 
                  placeholder="https://tiktok.com/@username" 
                  className="bg-transparent border-none outline-none text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                <input 
                  type="text" 
                  value={discord} 
                  onChange={e => setDiscord(e.target.value)} 
                  placeholder="Username / Discord Link" 
                  className="bg-transparent border-none outline-none text-xs w-full"
                />
              </div>
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
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

