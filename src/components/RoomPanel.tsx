import React, { useState } from 'react';
import { useSocialStore } from '../store/socialStore';

export function RoomPanel() {
    const { currentRoomId, joinRoom, leaveRoom } = useSocialStore();
    const [inputRoomId, setInputRoomId] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputRoomId.trim()) {
            joinRoom(inputRoomId.trim());
            setInputRoomId('');
            setIsOpen(false);
        }
    };

    const handleLeave = () => {
        leaveRoom();
    };

    return (
        <div className="room-control">
            {!isOpen && (
                <button className="room-toggle-btn" onClick={() => setIsOpen(true)}>
                    {currentRoomId ? `🔑 Room: ${currentRoomId}` : '🌐 Public'}
                </button>
            )}

            {isOpen && (
                <div className="room-panel">
                    <div className="room-header">
                        <h3>Private Room</h3>
                        <button onClick={() => setIsOpen(false)} className="close-btn">×</button>
                    </div>

                    <div className="room-content">
                        {currentRoomId ? (
                            <div className="current-room-info">
                                <p>You are in room:</p>
                                <div className="room-id-display">{currentRoomId}</div>
                                <button onClick={handleLeave} className="leave-btn">
                                    Leave Room (Go Public)
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleJoin} className="join-form">
                                <p>Enter a Room ID to join a private space.</p>
                                <input
                                    type="text"
                                    value={inputRoomId}
                                    onChange={(e) => setInputRoomId(e.target.value)}
                                    placeholder="e.g. secret-base"
                                    className="room-input"
                                />
                                <button type="submit" className="join-btn" disabled={!inputRoomId.trim()}>
                                    Join Room
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
