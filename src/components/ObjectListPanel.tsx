import { useObjectStore, creatureEmoji, type FlyingCreature } from '../store/objectStore';

interface ObjectListPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ObjectListPanel({ isOpen, onClose }: ObjectListPanelProps) {
    const { objects, removeObject } = useObjectStore();

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

    return (
        <>
            <div
                className={`object-list-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />
            <div className={`object-list-panel ${isOpen ? 'open' : ''}`}>
                <div className="object-list-handle" />
                <div className="object-list-header">
                    <h3>マイオブジェクト ({objects.length})</h3>
                    <button className="icon-btn" onClick={onClose}>✕</button>
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
                                    <div className="object-list-type">{getTypeLabel(obj)}</div>
                                </div>
                                <button
                                    className="object-list-delete-btn"
                                    onClick={() => removeObject(obj.id)}
                                >
                                    🗑️
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
