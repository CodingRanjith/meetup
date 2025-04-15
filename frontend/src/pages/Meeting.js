import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import './Meeting.css';

const socket = io('http://localhost:5000'); // Change to your server URL
let peer;

const Meeting = () => {
  const { roomId } = useParams();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);

  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      localVideo.current.srcObject = stream;
      socket.emit('join-room', roomId);

      socket.on('user-joined', userId => {
        callUser(userId, stream);
      });

      socket.on('offer', ({ offer, from }) => {
        answerCall(offer, from, stream);
      });

      socket.on('answer', ({ answer }) => {
        peer.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('ice-candidate', ({ candidate }) => {
        peer.addIceCandidate(new RTCIceCandidate(candidate));
      });

      socket.on('receive-message', ({ message, sender }) => {
        setMessages(prev => [...prev, { message, sender }]);
      });
    });

    return () => socket.disconnect();
  }, [roomId]);

  const callUser = async (userId, stream) => {
    peer = new RTCPeerConnection(config);
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = e => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    peer.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, to: userId });
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('offer', { offer, to: userId });
  };

  const answerCall = async (offer, from, stream) => {
    peer = new RTCPeerConnection(config);
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = e => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    peer.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, to: from });
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('answer', { answer, to: from });
  };

  const sendMessage = () => {
    if (msg.trim()) {
      socket.emit('send-message', { roomId, message: msg });
      setMessages(prev => [...prev, { message: msg, sender: 'You' }]);
      setMsg('');
    }
  };

  return (
    <div className="meeting-container">
  <header className="meeting-header">
    <h3>Room: {roomId}</h3>
  </header>

  <div className="meeting-content">
    {/* 📹 Partner Video Fullscreen */}
    <div className="video-area">
      <video ref={remoteVideo} autoPlay className="remote-video" />

      {/* 🧍 Your Video Floating Small */}
      <video ref={localVideo} autoPlay muted className="local-video mirror" />
    </div>

    {/* 💬 Chat Section */}
    <div className="chat-area">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.sender === 'You' ? 'you' : 'other'}`}>
            <strong>{m.sender}:</strong> {m.message}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  </div>
</div>

  );
};

export default Meeting;
