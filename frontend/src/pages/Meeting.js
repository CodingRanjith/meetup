import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import './Meeting.css';

const socket = io('https://meetup-xjjz.onrender.com');

const Meeting = () => {
  const { roomId } = useParams();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const peerRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    const config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };

    let streamRef;

    const handleCallUser = async (userId, stream) => {
      const peer = new RTCPeerConnection(config);
      peerRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (e) => {
        remoteVideo.current.srcObject = e.streams[0];
      };

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('ice-candidate', { candidate: e.candidate, to: userId });
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('offer', { offer, to: userId });
    };

    const handleAnswerCall = async (offer, from, stream) => {
      const peer = new RTCPeerConnection(config);
      peerRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (e) => {
        remoteVideo.current.srcObject = e.streams[0];
      };

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('ice-candidate', { candidate: e.candidate, to: from });
        }
      };

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', { answer, to: from });
    };

    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef = stream;
      localVideo.current.srcObject = stream;

      socket.emit('join-room', roomId);

      socket.on('user-joined', (userId) => handleCallUser(userId, stream));
      socket.on('offer', ({ offer, from }) => handleAnswerCall(offer, from, stream));
      socket.on('answer', ({ answer }) => {
        peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      });
      socket.on('ice-candidate', ({ candidate }) => {
        peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      });
      socket.on('receive-message', ({ message, sender }) => {
        setMessages((prev) => [...prev, { message, sender }]);
      });
    };

    init();

    return () => {
      socket.disconnect();
      if (peerRef.current) peerRef.current.close();
      if (streamRef) streamRef.getTracks().forEach((track) => track.stop());
    };
  }, [roomId]);

  const sendMessage = () => {
    if (msg.trim()) {
      socket.emit('send-message', { roomId, message: msg });
      setMessages((prev) => [...prev, { message: msg, sender: 'You' }]);
      setMsg('');
    }
  };

  const toggleMic = () => {
    const stream = localVideo.current?.srcObject;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicOn((prev) => !prev);
    }
  };

  const toggleCam = () => {
    const stream = localVideo.current?.srcObject;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setCamOn((prev) => !prev);
    }
  };

  return (
    <div className="meeting-container">
      <header className="meeting-header">
        <h3>Room: {roomId}</h3>
      </header>

      <div className="meeting-content">
        <div className="video-area">
          <video ref={remoteVideo} autoPlay className="remote-video" />
          <video ref={localVideo} autoPlay muted className="local-video mirror" />

          {/* Mute/Camera Buttons */}
          <div className="control-buttons">
            <button onClick={toggleMic} title="Toggle Microphone">
              {micOn ? '🎤 On' : '🔇 Off'}
            </button>
            <button onClick={toggleCam} title="Toggle Camera">
              {camOn ? '📷 On' : '📷 Off'}
            </button>
          </div>
        </div>

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
              onChange={(e) => setMsg(e.target.value)}
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
