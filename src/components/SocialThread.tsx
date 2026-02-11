import React, { useState } from 'react';
import { useSocialStore } from '../store/socialStore';


interface SocialThreadProps {
    objectId: string;
    objectName: string;
    onClose: () => void;
}

export function SocialThread({ objectId, objectName, onClose }: SocialThreadProps) {
    const { objectComments, objectReactions, sendReaction, postComment } = useSocialStore();
    const [commentText, setCommentText] = useState('');

    const comments = objectComments.get(objectId) || [];
    const reactions = objectReactions.get(objectId) || [];

    // 日付フォーマット
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        postComment(objectId, commentText);
        setCommentText('');
    };

    return (
        <div className="social-thread-panel">
            <div className="thread-header">
                <h3>{objectName}</h3>
                <button onClick={onClose} className="close-btn">×</button>
            </div>

            <div className="thread-content">
                <div className="reaction-section">
                    <button
                        className={`like-btn ${reactions.length > 0 ? 'active' : ''}`}
                        onClick={() => sendReaction(objectId)}
                    >
                        ❤️ {reactions.length}
                    </button>
                    <span className="reaction-label">いいね！</span>
                </div>

                <div className="comments-list">
                    {comments.length === 0 ? (
                        <div className="no-comments">コメントはまだありません</div>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="comment-item">
                                <div className="comment-bubble">
                                    {comment.text}
                                </div>
                                <div className="comment-meta">
                                    User-{comment.userId.slice(0, 4)} • {formatDate(comment.timestamp)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <form onSubmit={handleSend} className="comment-form">
                <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="コメントを入力..."
                    className="comment-input"
                />
                <button type="submit" className="send-btn" disabled={!commentText.trim()}>
                    送信
                </button>
            </form>
        </div>
    );
}
