import { useState } from 'react';
import type { UGCType, UGCProperties } from '../types/ugc';

interface UGCCreatorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (type: UGCType, props: UGCProperties) => void;
}

export function UGCCreatorPanel({ isOpen, onClose, onCreate }: UGCCreatorPanelProps) {
    const [selectedType, setSelectedType] = useState<UGCType>('TEXT');

    // Properties
    const [text, setText] = useState('Hello World');
    const [color, setColor] = useState('#ffffff');
    const [fontSize, setFontSize] = useState(24);
    const [scale, setScale] = useState(1);
    const [url, setUrl] = useState('');
    const [isEmissive, setIsEmissive] = useState(false);

    if (!isOpen) return null;

    const handleCreate = () => {
        const props: UGCProperties = {
            scale,
            rotation: [0, 0, 0], // Default upright
        };

        if (selectedType === 'TEXT') {
            props.text = text;
            props.fontColor = color;
            props.fontSize = fontSize;
            props.isEmissive = isEmissive;
        } else if (selectedType === 'MEDIA') {
            props.url = url;
            props.mediaType = 'image'; // TODO: Auto-detect or selector
            props.aspectRatio = 1.0; // TODO: Detect
        } else if (selectedType === 'MODEL') {
            props.modelUrl = url;
        } else if (selectedType === 'AUDIO') {
            props.audioUrl = url;
            props.volume = 1.0;
            props.maxDistance = 50;
        }

        onCreate(selectedType, props);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // For MVP: Use FileReader to get Base64 (limit size!) or Blob URL
        // Warning: Blob URL is temporary. Base64 is heavy.
        // Let's use Base64 for now if < 1MB, otherwise warn.
        if (file.size > 1024 * 1024) {
            alert('ファイルサイズが大きすぎます (1MBまで)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            if (typeof ev.target?.result === 'string') {
                setUrl(ev.target.result);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="ugc-panel-overlay">
            <div className="ugc-panel">
                <div className="ugc-header">
                    <h3>クリエイトモード</h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="ugc-tabs">
                    <button className={selectedType === 'TEXT' ? 'active' : ''} onClick={() => setSelectedType('TEXT')}>📝 テキスト</button>
                    <button className={selectedType === 'MEDIA' ? 'active' : ''} onClick={() => setSelectedType('MEDIA')}>🖼️ 写真</button>
                    <button className={selectedType === 'MODEL' ? 'active' : ''} onClick={() => setSelectedType('MODEL')}>📦 モデル</button>
                    <button className={selectedType === 'AUDIO' ? 'active' : ''} onClick={() => setSelectedType('AUDIO')}>🔊 音声</button>
                </div>

                <div className="ugc-form">
                    {/* Common: Scale */}
                    <div className="form-group">
                        <label>サイズ: {scale}x</label>
                        <input type="range" min="0.5" max="5.0" step="0.1" value={scale} onChange={e => setScale(Number(e.target.value))} />
                    </div>

                    {selectedType === 'TEXT' && (
                        <>
                            <div className="form-group">
                                <label>メッセージ</label>
                                <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="何か入力してください" />
                            </div>
                            <div className="form-group">
                                <label>カラー</label>
                                <input type="color" value={color} onChange={e => setColor(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>フォントサイズ: {fontSize}px</label>
                                <input type="range" min="12" max="128" step="4" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label>発光</label>
                                <input type="checkbox" checked={isEmissive} onChange={e => setIsEmissive(e.target.checked)} />
                            </div>
                        </>
                    )}

                    {(selectedType === 'MEDIA' || selectedType === 'MODEL' || selectedType === 'AUDIO') && (
                        <div className="form-group">
                            <label>ファイル (URL または アップロード)</label>
                            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
                            <input type="file" onChange={handleFileSelect} accept={
                                selectedType === 'MEDIA' ? "image/*" :
                                    selectedType === 'MODEL' ? ".glb,.gltf" :
                                        selectedType === 'AUDIO' ? "audio/*" : "*"
                            } />
                        </div>
                    )}

                    <button className="create-btn" onClick={handleCreate} disabled={selectedType !== 'TEXT' && !url}>
                        配置する
                    </button>
                </div>
            </div>

            <style>{`
                .ugc-panel-overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    pointer-events: auto;
                }
                .ugc-panel {
                    background: rgba(20, 20, 30, 0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    width: 90%;
                    max-width: 400px;
                    padding: 20px;
                    color: white;
                }
                .ugc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .ugc-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    overflow-x: auto;
                    padding-bottom: 5px;
                }
                .ugc-tabs button {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #aaa;
                    padding: 8px 12px;
                    border-radius: 8px;
                    white-space: nowrap;
                    font-size: 14px;
                }
                .ugc-tabs button.active {
                    background: #4488ff;
                    color: white;
                }
                .form-group {
                    margin-bottom: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    text-align: left;
                }
                .form-group label {
                    font-size: 12px;
                    color: #ccc;
                }
                .form-group input[type="text"] {
                    background: rgba(0,0,0,0.3);
                    border: 1px solid #555;
                    padding: 8px;
                    border-radius: 4px;
                    color: white;
                }
                .create-btn {
                    width: 100%;
                    background: linear-gradient(135deg, #00f260, #0575e6);
                    border: none;
                    padding: 12px;
                    font-weight: bold;
                    color: white;
                    border-radius: 8px;
                    margin-top: 10px;
                }
                .create-btn:disabled {
                    opacity: 0.5;
                }
            `}</style>
        </div>
    );
}
