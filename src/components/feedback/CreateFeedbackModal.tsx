import React, { useState, useEffect } from 'react';
import { X, Lock, Globe, UserCheck, Send, AlertCircle, Search } from 'lucide-react';
import { collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface UserOption {
  id: string;
  displayName: string;
  avatar: string;
  email?: string;
  creatorStatus?: boolean;
}

interface CreateFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultRecipientId?: string;
}

export default function CreateFeedbackModal({
  isOpen,
  onClose,
  onSuccess,
  defaultRecipientId
}: CreateFeedbackModalProps) {
  const { user, firebaseUser } = useAuthStore();

  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<UserOption | null>(null);

  const [mode, setMode] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch available users for recipient selection
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: UserOption[] = [];
        snap.docs.forEach(docSnap => {
          const uData = docSnap.data();
          if (docSnap.id !== user?.id && !uData.deletedAt) {
            list.push({
              id: docSnap.id,
              displayName: uData.displayName || 'Thành viên',
              avatar: uData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${docSnap.id}`,
              email: uData.email,
              creatorStatus: uData.creatorStatus
            });
          }
        });
        setUsersList(list);

        if (defaultRecipientId) {
          const match = list.find(u => u.id === defaultRecipientId);
          if (match) setSelectedRecipient(match);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách người dùng:", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, user?.id, defaultRecipientId]);

  if (!isOpen) return null;

  const filteredUsers = usersList.filter(u =>
    u.displayName.toLowerCase().includes(recipientSearch.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(recipientSearch.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Vui lòng đăng nhập để gửi Feedback!");
      return;
    }

    if (!selectedRecipient) {
      toast.error("Vui lòng chọn người nhận Feedback!");
      return;
    }

    if (!content.trim()) {
      toast.error("Vui lòng nhập nội dung Feedback!");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create feedback document
      const currentSenderId = user.id || firebaseUser?.uid;
      const feedbackData = {
        senderId: currentSenderId,
        senderName: user.displayName,
        senderAvatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        recipientId: selectedRecipient.id,
        recipientName: selectedRecipient.displayName,
        recipientAvatar: selectedRecipient.avatar,
        mode: mode,
        title: title.trim(),
        content: content.trim(),
        reactions: {},
        reactionsCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null
      };

      const fbRef = await addDoc(collection(db, 'feedbacks'), feedbackData);

      // 2. Create notification for recipient
      await addDoc(collection(db, 'notifications'), {
        userId: selectedRecipient.id,
        recipientId: selectedRecipient.id,
        senderId: user.id,
        senderName: user.displayName,
        senderAvatar: user.avatar || '',
        type: 'FEEDBACK',
        targetId: fbRef.id,
        targetType: 'FEEDBACK',
        title: mode === 'PUBLIC' ? 'Có Feedback công khai mới' : 'Có Feedback riêng tư mới',
        message: `${user.displayName} vừa gửi cho bạn một Feedback ${mode === 'PUBLIC' ? 'công khai' : 'riêng tư'}.`,
        link: '/feedbacks',
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success(`Đã gửi Feedback ${mode === 'PUBLIC' ? 'công khai' : 'riêng tư'} thành công!`);
      
      // Reset form
      setContent('');
      setTitle('');
      setSelectedRecipient(null);
      setRecipientSearch('');

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Gửi Feedback thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-500" />
            <h2 className="font-extrabold text-lg text-neutral-900 dark:text-neutral-100">
              Gửi Feedback Mới
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Sender Info (Auto) */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-medium">Người gửi (Tự động):</span>
            <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
                alt="Sender Avatar"
                className="w-5 h-5 rounded-full object-cover border"
              />
              <span>{user?.displayName}</span>
            </div>
          </div>

          {/* Recipient Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Người nhận <span className="text-red-500">*</span>
            </label>

            {selectedRecipient ? (
              <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedRecipient.avatar}
                    alt={selectedRecipient.displayName}
                    className="w-8 h-8 rounded-full border border-indigo-500/30 object-cover"
                  />
                  <div>
                    <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {selectedRecipient.displayName}
                    </div>
                    {selectedRecipient.creatorStatus && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold">Creator</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="text-xs font-semibold text-neutral-500 hover:text-red-500 underline"
                >
                  Đổi người nhận
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên hoặc email người nhận..."
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-xl divide-y divide-neutral-100 dark:divide-neutral-800">
                  {loadingUsers ? (
                    <div className="p-4 text-center text-xs text-neutral-400">Đang tải người dùng...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-neutral-400">Không tìm thấy người dùng phù hợp.</div>
                  ) : (
                    filteredUsers.map(u => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedRecipient(u)}
                        className="w-full p-2.5 flex items-center justify-between text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img src={u.avatar} alt={u.displayName} className="w-6 h-6 rounded-full object-cover" />
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{u.displayName}</span>
                        </div>
                        <UserCheck className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mode Selector (Công khai vs Riêng tư) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Chọn chế độ Feedback <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Public Feedback */}
              <button
                type="button"
                onClick={() => setMode('PUBLIC')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${
                  mode === 'PUBLIC'
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                    : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span>Feedback Công Khai</span>
                </div>
                <p className="text-[10px] opacity-80 leading-relaxed">
                  Hiển thị như bài đăng cộng đồng. Mọi người đều có thể xem, thả cảm xúc và bình luận.
                </p>
              </button>

              {/* Private Feedback */}
              <button
                type="button"
                onClick={() => setMode('PRIVATE')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${
                  mode === 'PRIVATE'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                    : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>Feedback Riêng Tư</span>
                </div>
                <p className="text-[10px] opacity-80 leading-relaxed">
                  Gửi thư bảo mật dạng Email. Chỉ duy nhất bạn và người nhận có thể xem và trả lời.
                </p>
              </button>
            </div>
          </div>

          {/* Title (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Tiêu đề <span className="text-neutral-400 font-normal">(Tùy chọn)</span>
            </label>
            <input
              type="text"
              placeholder="VD: Cảm ơn sự đóng góp của bạn..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>

          {/* Content (Required) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Nội dung Feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={5}
              placeholder={
                mode === 'PUBLIC'
                  ? 'Viết nhận xét, đóng góp công khai cho thành viên này...'
                  : 'Viết tin nhắn, góp ý riêng tư bảo mật...'
              }
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full p-3.5 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-black dark:focus:border-white leading-relaxed resize-none"
            />
          </div>

          {/* Notice info */}
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl text-[11px] text-neutral-500 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" />
            <span>
              {mode === 'PUBLIC'
                ? 'Feedback công khai sẽ xuất hiện trên bảng tin Feedback cộng đồng.'
                : 'Feedback riêng tư bảo mật, không xuất hiện trên bảng tin và không ai khác có thể xem.'}
            </span>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedRecipient || !content.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-extrabold text-xs hover:opacity-90 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <span>Đang gửi...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
