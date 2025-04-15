import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoom = Math.random().toString(36).substring(2, 8);
    navigate(`/meeting/${newRoom}`);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      navigate(`/meeting/${roomId}`);
    }
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1>✨ InstaMeet</h1>
        <p>Connect in real-time. Chat & video made elegant.</p>

        <button className="create-btn" onClick={createRoom}>+ Create New Room</button>

        <div className="divider">or</div>

        <input
          className="room-input"
          placeholder="Enter Room Code"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button className="join-btn" onClick={joinRoom}>Join Room</button>
      </div>
    </div>
  );
};

export default Home;
