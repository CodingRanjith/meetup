import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './Meeting.css';

const socket = io('https://meetup-xjjz.onrender.com');

const Meeting = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
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

    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.current.srcObject = stream;

      socket.emit('join-room', roomId);

      

      socket.on('user-joined', async (userId) => {
        console.log('User joined:', userId);
        new Audio('/join.mp3').play();

        peerRef.current = new RTCPeerConnection(config);
        stream.getTracks().forEach((track) => peerRef.current.addTrack(track, stream));

        peerRef.current.ontrack = (event) => {
          remoteVideo.current.srcObject = event.streams[0];
        };

        peerRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
          }
        };

        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socket.emit('offer', { offer, to: userId });
      });

      socket.on('offer', async ({ offer, from }) => {
        console.log('Offer received');
        peerRef.current = new RTCPeerConnection(config);
        stream.getTracks().forEach((track) => peerRef.current.addTrack(track, stream));

        peerRef.current.ontrack = (event) => {
          remoteVideo.current.srcObject = event.streams[0];
        };

        peerRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, to: from });
          }
        };

        await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit('answer', { answer, to: from });
      });

      socket.on('answer', ({ answer }) => {
        console.log('Answer received');
        peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('ice-candidate', ({ candidate }) => {
        console.log('ICE candidate received');
        peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      });

      socket.on('receive-message', ({ message, sender }) => {
        setMessages((prev) => [...prev, { message, sender }]);
      });
    };

    init();


    const localVideoRef = localVideo.current;

return () => {
  socket.disconnect();
  if (peerRef.current) peerRef.current.close();
  if (localVideoRef?.srcObject) {
    const localStream = localVideoRef.srcObject;
    localStream.getTracks().forEach((track) => track.stop());
  }
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
      stream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
      setMicOn((prev) => !prev);
    }
  };

  const toggleCam = () => {
    const stream = localVideo.current?.srcObject;
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
      setCamOn((prev) => !prev);
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('✅ Room link copied to clipboard!');
  };

  const leaveRoom = () => {
    navigate('/');
  };

  return (
    <div className="meeting-container">
      <header className="meeting-header">
        <h3>Room: {roomId}</h3>
        <button onClick={copyRoomLink} className="link-btn">🔗 Copy Link</button>
        <button onClick={leaveRoom} className="leave-btn">🚪 Leave Room</button>
      </header>

      <div className="meeting-content">
        <div className="video-area">
          <video ref={remoteVideo} autoPlay className="remote-video" />
          <video ref={localVideo} autoPlay muted className="local-video mirror" />

          <div className="control-buttons">
            <button onClick={toggleMic}>{micOn ? '🎤 On' : '🔇 Off'}</button>
            <button onClick={toggleCam}>{camOn ? '📷 On' : '📷 Off'}</button>
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
