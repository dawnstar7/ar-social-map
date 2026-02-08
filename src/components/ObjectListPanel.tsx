import { useState } from 'react';
import { useObjectStore, creatureEmoji, type FlyingCreature } from '../store/objectStore';

interface ObjectListPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ObjectListPanel({ isOpen, onClose }: ObjectListPanelProps) {
    const { objects, removeObject, clearAll } = useObjectStore();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmClearAll, setConfirmClearAll] = useState(false);

    const getIcon = (obj: { objectType: string; creature?: FlyingCreature }) => {
        if (obj.objectType === 'flying' && obj.creature) {
            return creatureEmoji[obj.creature];
        }
        return '📍';
    };

    const getTypeLabel = (obj: { objectType: string; creature?: FlyingCreature }) => {
        if (obj.objectType === 'flying' && obj.creature) {
            return '飛行';
        }
        return '静止';
    };

    const handleDelete = (id: string) => {
        if (confirmDeleteId === id) {
            removeObject(id);
            setConfirmDeleteId(null);
        } else {
            setConfirmDeleteId(id);
        }
    };

    const handleClearAll = () => {
        if (confirmClearAll) {
            clearAll();
            setConfirmClearAll(false);
        } else {
            setConfirmClearAll(true);
        }
    };

    return (
        <>
            <div
                className={`object-list-overlay ${isOpen ? 'open' : ''}`}
                onClick={() => { onClose(); setConfirmDeleteId(null); setConfirmClearAll(false); }}
            />
            <div className={`object-list-panel ${isOpen ? 'open' : ''}`}>
                <div className="object-list-handle" />
                <div className="object-list-header">
                    <h3>マイオブジェクト ({objects.length})</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {objects.length > 0 && (
                            <button
                                className={`object-list-clear-btn ${confirmClearAll ? 'confirm' : ''}`}
                                onClick={handleClearAll}
                            >
                                {confirmClearAll ? '本当に全削除？' : '全削除'}
                            </button>
                        )}
                        <button className="icon-btn" onClick={() => { onClose(); setConfirmDeleteId(null); setConfirmClearAll(false); }}>✕</button>
                    </div>
                </div>
                <div className="object-list-items">
                    {objects.length === 0 ? (
                        <div className="object-list-empty">
                            オブジェクトがありません<br />
                            マップから配置してください
                        </div>
                    ) : (
                        objects.map((obj) => (
                            <div key={obj.id} className="object-list-item">
                                <span className="object-list-icon">{getIcon(obj)}</span>
                                <div className="object-list-info">
                                    <div className="object-list-name">{obj.name}</div>
                                    <div className="object-list-meta">
                                        <span className="object-list-type">{getTypeLabel(obj)}</span>
                                        <span className="object-list-coords">
                                            高度{(obj.position.altitude || 0).toFixed(0)}m
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className={`object-list-delete-btn ${confirmDeleteId === obj.id ? 'confirm' : ''}`}
                                    onClick={() => handleDelete(obj.id)}
                                >
                                    {confirmDeleteId === obj.id ? '確認' : '🗑️'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
