/**
 * Bob Chat Module — Native Voice Chat for Mission Control
 * Push-to-talk voice conversations with any of the 6 Bobs.
 * STT: OpenAI Whisper | LLM: Gateway /v1/chat/completions | TTS: OpenAI TTS
 */

const BobChat = (function() {
    'use strict';

    // ========================================
    // Bob Definitions
    // ========================================

    const BOBS = {
        main:     { name: 'Main Bob',     emoji: '🎯', avatar: 'avatars/main.png',     elevenLabsVoice: 'pNInz6obpgDQGcFmaJgB', openaiVoice: 'alloy',   system: 'You are Main Bob, the orchestrator of the Bob Collective. This is a VOICE conversation. Keep responses SHORT (1-3 sentences). No markdown. Speak naturally and conversationally.\n\nYou can use expressive tags to control how your voice sounds:\n[laughs] [whispers] [sighs] [slow] [excited]\nEach tag affects ~4-5 words. Use naturally and sparingly.' },
        kcc:      { name: 'KCC Bob',      emoji: '🏗️', avatar: 'avatars/kcc.png',      elevenLabsVoice: 'VR6AewLTigWG4xSOukaG', openaiVoice: 'echo',    system: 'You are KCC Bob, managing Kippen Concrete & Excavation. This is a VOICE conversation. Keep responses SHORT (1-3 sentences). No markdown. Speak naturally about construction, concrete, excavation business.\n\nYou can use expressive tags to control how your voice sounds:\n[laughs] [whispers] [sighs] [slow] [excited]\nEach tag affects ~4-5 words. Use naturally and sparingly.' },
        dmi:      { name: 'DMI Bob',      emoji: '🔧', avatar: 'avatars/dmi.png',      elevenLabsVoice: 'CYw3kZ02Hs0563khs1Fj', openaiVoice: 'fable',   system: 'You are DMI Bob, managing DMI Tools Corp. This is a VOICE conversation. Keep responses SHORT (1-3 sentences). No markdown. Speak naturally about tools, inventory, and e-commerce.\n\nYou can use expressive tags to control how your voice sounds:\n[laughs] [whispers] [sighs] [slow] [excited]\nEach tag affects ~4-5 words. Use naturally and sparingly.' },
        sawdot:   { name: 'SawDot Bob',   emoji: '🪚', avatar: 'avatars/sawdot.png',   elevenLabsVoice: 'IKne3meq5aSn9XLyUdCD', openaiVoice: 'onyx',    system: 'You are SawDot Bob, managing SawDot (saw blade sharpening). This is a VOICE conversation. Keep responses SHORT (1-3 sentences). No markdown. Speak naturally about saw blades and sharpening.\n\nYou can use expressive tags to control how your voice sounds:\n[laughs] [whispers] [sighs] [slow] [excited]\nEach tag affects ~4-5 words. Use naturally and sparingly.' },
        mrbex:    { name: 'mrbex Bob',    emoji: '🎬', avatar: 'avatars/mrbex.png',    elevenLabsVoice: 'D38z5RcWu1voky8WS1ja', openaiVoice: 'nova',    system: 'You are mrbex Bob, managing creative and media projects. This is a VOICE conversation. Keep responses SHORT (1-3 sentences). No markdown. Speak naturally and creatively.\n\nYou can use expressive tags to control how your voice sounds:\n[laughs] [whispers] [sighs] [slow] [excited]\nEach tag affects ~4-5 words. Use naturally and sparingly.' },
        personal: { name: 'Personal Bob', emoji: '🏠', avatar: 'avatars/personal.png', elevenLabsVoice: 'ErXwobaYiN019PkySvjV', openaiVoice: 'shimmer', system: 'You are Personal Bob, handling personal life and home matters. This is a VOICE conversation. Keep responses SHORT (1-3 sentences). No markdown. Speak naturally and warmly.\n\nYou can use expressive tags to control how your voice sounds:\n[laughs] [whispers] [sighs] [slow] [excited]\nEach tag affects ~4-5 words. Use naturally and sparingly.' }
    };

    const MAX_HISTORY = 10; // max exchanges per bob (10 user + 10 assistant = 20 messages)
    const OPENAI_KEY_STORAGE = 'mc_openai_key';
    const ELEVENLABS_KEY_STORAGE = 'mc_elevenlabs_key';

    // ========================================
    // State
    // ========================================

    let currentBob = 'main';
    let state = 'ready'; // ready | recording | thinking | speaking
    let mediaRecorder = null;
    let audioChunks = [];
    let audioContext = null;
    let analyser = null;
    let currentAudio = null;
    let animationFrameId = null;
    let audioUnlocked = false;
    let mediaSource = null;

    // Conversation histories per bob
    const histories = {};
    Object.keys(BOBS).forEach(k => { histories[k] = []; });

    // ========================================
    // DOM References
    // ========================================

    let els = {};

    function cacheDom() {
        els = {
            selector:    document.getElementById('bobChatSelector'),
            avatar:      document.getElementById('bobChatAvatar'),
            avatarImg:   document.getElementById('bobChatAvatarImg'),
            status:      document.getElementById('bobChatStatus'),
            audioUnlock: document.getElementById('bobChatAudioUnlock'),
            messages:    document.getElementById('bobChatMessages'),
            mic:         document.getElementById('bobChatMic'),
            clear:       document.getElementById('bobChatClear'),
            apiNotice:   document.getElementById('bobChatApiNotice'),
            setKey:      document.getElementById('bobChatSetKey')
        };
    }

    // ========================================
    // Initialization
    // ========================================

    function init() {
        cacheDom();
        if (!els.mic) {
            console.warn('Bob Chat: DOM elements not found');
            return;
        }

        // Event listeners
        els.selector.addEventListener('change', handleBobChange);
        els.clear.addEventListener('click', handleClear);
        els.setKey?.addEventListener('click', () => {
            if (window.QuickActions?.openSettingsModal) {
                window.QuickActions.openSettingsModal();
            }
        });

        // Push-to-talk: pointer events for cross-device support
        els.mic.addEventListener('pointerdown', handleMicDown);
        els.mic.addEventListener('pointerup', handleMicUp);
        els.mic.addEventListener('pointerleave', handleMicUp);
        els.mic.addEventListener('pointercancel', handleMicUp);
        // Prevent context menu on long press (mobile)
        els.mic.addEventListener('contextmenu', e => e.preventDefault());

        // Audio unlock for mobile
        els.audioUnlock.addEventListener('click', unlockAudio);

        // Check if audio is already unlocked (desktop usually is)
        checkAudioUnlock();

        // Update UI
        updateApiNotice();
        updateAvatar();
        renderMessages();

        console.log('🎙️ Bob Chat initialized');
    }

    // ========================================
    // Audio Unlock (Mobile)
    // ========================================

    function checkAudioUnlock() {
        // On desktop, AudioContext usually works without user gesture
        // On mobile (iOS/Android), we need a user tap first
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (!isMobile) {
            audioUnlocked = true;
            els.audioUnlock.style.display = 'none';
        } else {
            els.audioUnlock.style.display = '';
        }
    }

    function unlockAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Create and play a silent buffer to unlock
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
            audioUnlocked = true;
            els.audioUnlock.style.display = 'none';
            console.log('🔊 Audio unlocked');
        } catch (e) {
            console.error('Audio unlock failed:', e);
        }
    }

    // ========================================
    // Bob Selection
    // ========================================

    function handleBobChange() {
        currentBob = els.selector.value;
        updateAvatar();
        renderMessages();
    }

    function updateAvatar() {
        const bob = BOBS[currentBob];
        els.avatarImg.src = bob.avatar;
        els.avatarImg.alt = bob.name;
        // Reset glow
        els.avatar.style.setProperty('--ring-opacity', '0.2');
        els.avatar.style.setProperty('--ring-scale', '1');
    }

    // ========================================
    // API Key Management
    // ========================================

    function getOpenAIKey() {
        return localStorage.getItem(OPENAI_KEY_STORAGE) || '';
    }

    function getElevenLabsKey() {
        return localStorage.getItem(ELEVENLABS_KEY_STORAGE) || '';
    }

    function updateApiNotice() {
        const hasOpenAI = !!getOpenAIKey();
        const hasElevenLabs = !!getElevenLabsKey();
        const hasGateway = Gateway.hasToken();
        
        if ((hasOpenAI || hasElevenLabs) && hasGateway) {
            els.apiNotice.style.display = 'none';
        } else {
            els.apiNotice.style.display = '';
            const parts = [];
            if (!hasOpenAI && !hasElevenLabs) parts.push('TTS API key (ElevenLabs or OpenAI)');
            if (!hasGateway) parts.push('Gateway token');
            const notice = els.apiNotice.querySelector('p');
            if (notice) {
                notice.innerHTML = `${parts.join(' and ')} required. <button id="bobChatSetKey">Configure →</button>`;
                document.getElementById('bobChatSetKey')?.addEventListener('click', () => {
                    if (window.QuickActions?.openSettingsModal) {
                        window.QuickActions.openSettingsModal();
                    }
                });
            }
        }
    }

    // ========================================
    // State & Status
    // ========================================

    function setState(newState) {
        state = newState;
        const labels = {
            ready: 'Ready',
            recording: '🔴 Recording...',
            thinking: '🤔 Thinking...',
            speaking: '🔊 Speaking...'
        };
        els.status.textContent = labels[newState] || 'Ready';
        els.status.className = 'bob-chat-status' + (newState !== 'ready' ? ` bob-chat-status--${newState}` : '');

        // Mic button state
        els.mic.classList.toggle('recording', newState === 'recording');
        els.mic.disabled = (newState === 'thinking' || newState === 'speaking');

        // Avatar glow states
        if (newState === 'recording') {
            els.avatar.style.setProperty('--ring-color', '239, 68, 68'); // red
            els.avatar.style.setProperty('--ring-opacity', '0.6');
        } else if (newState === 'thinking') {
            els.avatar.style.setProperty('--ring-color', '168, 85, 247'); // purple
            pulsateRing();
        } else if (newState === 'speaking') {
            els.avatar.style.setProperty('--ring-color', '59, 130, 246'); // blue
        } else {
            els.avatar.style.setProperty('--ring-color', '59, 130, 246');
            els.avatar.style.setProperty('--ring-opacity', '0.2');
            els.avatar.style.setProperty('--ring-scale', '1');
            cancelAnimationFrame(animationFrameId);
        }
    }

    function pulsateRing() {
        let t = 0;
        function pulse() {
            t += 0.05;
            const opacity = 0.3 + 0.3 * Math.sin(t);
            const scale = 1 + 0.05 * Math.sin(t);
            els.avatar.style.setProperty('--ring-opacity', opacity.toFixed(2));
            els.avatar.style.setProperty('--ring-scale', scale.toFixed(3));
            if (state === 'thinking') {
                animationFrameId = requestAnimationFrame(pulse);
            }
        }
        pulse();
    }

    // ========================================
    // Push-to-Talk Recording
    // ========================================

    async function handleMicDown(e) {
        e.preventDefault();

        if (state !== 'ready') return;

        // Check prerequisites
        const openaiKey = getOpenAIKey();
        if (!openaiKey) {
            showToast('Set your OpenAI API key in ⚙️ Settings first', 'warning');
            return;
        }
        if (!Gateway.hasToken()) {
            showToast('Configure Gateway in ⚙️ Settings first', 'warning');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];

            // Try webm first, fall back to other formats
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : MediaRecorder.isTypeSupported('audio/mp4')
                        ? 'audio/mp4'
                        : '';

            const options = mimeType ? { mimeType } : {};
            mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                // Stop all tracks
                stream.getTracks().forEach(t => t.stop());
                // Process the recording
                processRecording();
            };

            mediaRecorder.start(100); // collect chunks every 100ms
            setState('recording');
        } catch (err) {
            console.error('Mic access error:', err);
            showToast('Microphone access denied. Check browser permissions.', 'error');
        }
    }

    function handleMicUp(e) {
        e.preventDefault();
        if (state !== 'recording' || !mediaRecorder) return;

        if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
    }

    // ========================================
    // Processing Pipeline: STT → LLM → TTS
    // ========================================

    async function processRecording() {
        if (audioChunks.length === 0) {
            setState('ready');
            return;
        }

        const mimeType = mediaRecorder?.mimeType || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        audioChunks = [];

        // Skip tiny recordings (accidental taps)
        if (audioBlob.size < 1000) {
            setState('ready');
            return;
        }

        setState('thinking');

        try {
            // Step 1: STT — Whisper
            const transcription = await transcribeAudio(audioBlob, ext);
            if (!transcription || !transcription.trim()) {
                showToast('Could not understand audio. Try again.', 'info');
                setState('ready');
                return;
            }

            // Add user message
            addMessage('user', transcription);

            // Step 2: LLM — Gateway
            const response = await getLLMResponse(transcription);
            if (!response) {
                showToast('No response from Bob. Try again.', 'error');
                setState('ready');
                return;
            }

            // Add assistant message
            addMessage('assistant', response);

            // Step 3: TTS — OpenAI
            setState('speaking');
            await speakResponse(response);

            setState('ready');
        } catch (err) {
            console.error('Pipeline error:', err);
            showToast(`Error: ${err.message}`, 'error');
            setState('ready');
        }
    }

    // ========================================
    // STT: OpenAI Whisper
    // ========================================

    async function transcribeAudio(audioBlob, ext) {
        const openaiKey = getOpenAIKey();
        const formData = new FormData();
        formData.append('file', audioBlob, `recording.${ext}`);
        formData.append('model', 'whisper-1');

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}` },
            body: formData
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Whisper API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data.text || '';
    }

    // ========================================
    // LLM: Gateway Chat Completions
    // ========================================

    async function getLLMResponse(userText) {
        const bob = BOBS[currentBob];
        const history = histories[currentBob];

        const messages = [
            { role: 'system', content: bob.system },
            ...history,
            { role: 'user', content: userText }
        ];

        const response = await Gateway.request('/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'openclaw:main',
                messages
            })
        });

        const text = response?.choices?.[0]?.message?.content || '';
        return text;
    }

    // ========================================
    // TTS: OpenAI Text-to-Speech
    // ========================================

    async function speakResponse(text) {
        const elevenLabsKey = getElevenLabsKey();
        const openaiKey = getOpenAIKey();
        const bob = BOBS[currentBob];
        let blob;
        let url;

        try {
            if (!elevenLabsKey) throw new Error('No ElevenLabs key');

            const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${bob.elevenLabsVoice}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': elevenLabsKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_v3'
                })
            });

            if (!elRes.ok) {
                const errText = await elRes.text().catch(() => '');
                throw new Error(`ElevenLabs error ${elRes.status}: ${errText}`);
            }

            blob = await elRes.blob();
        } catch (elErr) {
            console.warn('ElevenLabs TTS failed, falling back to OpenAI:', elErr);
            
            if (!openaiKey) {
                throw new Error('No TTS API keys available (ElevenLabs failed and no OpenAI key)');
            }

            const oaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    voice: bob.openaiVoice,
                    input: text
                })
            });

            if (!oaiRes.ok) {
                const errText = await oaiRes.text().catch(() => '');
                throw new Error(`OpenAI TTS error ${oaiRes.status}: ${errText}`);
            }

            blob = await oaiRes.blob();
        }

        url = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            // Clean up previous audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            const audio = new Audio(url);
            currentAudio = audio;

            // Set up volume-reactive glow
            setupAudioAnalyser(audio);

            audio.onended = () => {
                stopAnalyser();
                URL.revokeObjectURL(url);
                currentAudio = null;
                resolve();
            };

            audio.onerror = (e) => {
                stopAnalyser();
                URL.revokeObjectURL(url);
                currentAudio = null;
                reject(new Error('Audio playback failed'));
            };

            audio.play().catch(err => {
                // If autoplay blocked, try unlocking
                console.warn('Autoplay blocked:', err);
                stopAnalyser();
                URL.revokeObjectURL(url);
                currentAudio = null;
                resolve(); // Don't reject — the text is still shown
            });
        });
    }

    // ========================================
    // Audio Analyser (Volume-Reactive Glow)
    // ========================================

    function setupAudioAnalyser(audioElement) {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume if suspended (mobile)
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            // Create source — note: can only call createMediaElementSource once per element
            mediaSource = audioContext.createMediaElementSource(audioElement);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;

            mediaSource.connect(analyser);
            analyser.connect(audioContext.destination);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            function animate() {
                if (state !== 'speaking') return;

                analyser.getByteFrequencyData(dataArray);

                // Calculate average volume (0-255)
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avg = sum / dataArray.length;

                // Map to glow properties
                const norm = avg / 255;
                const opacity = 0.2 + norm * 0.8;
                const scale = 1 + norm * 0.15;
                const blur = 15 + norm * 20;

                els.avatar.style.setProperty('--ring-opacity', opacity.toFixed(2));
                els.avatar.style.setProperty('--ring-scale', scale.toFixed(3));
                els.avatar.style.setProperty('--ring-blur', blur.toFixed(0) + 'px');

                animationFrameId = requestAnimationFrame(animate);
            }

            animate();
        } catch (e) {
            console.warn('Audio analyser setup failed:', e);
        }
    }

    function stopAnalyser() {
        cancelAnimationFrame(animationFrameId);
        // Reset glow
        els.avatar?.style.setProperty('--ring-opacity', '0.2');
        els.avatar?.style.setProperty('--ring-scale', '1');
        els.avatar?.style.setProperty('--ring-blur', '15px');
        // Disconnect
        if (mediaSource) {
            try { mediaSource.disconnect(); } catch(e) {}
            mediaSource = null;
        }
        analyser = null;
    }

    // ========================================
    // Conversation History & Messages
    // ========================================

    function addMessage(role, content) {
        const history = histories[currentBob];
        history.push({ role, content });

        // Trim to MAX_HISTORY exchanges (each exchange = 1 user + 1 assistant)
        while (history.length > MAX_HISTORY * 2) {
            history.shift();
        }

        renderMessages();
    }

    function renderMessages() {
        if (!els.messages) return;

        const history = histories[currentBob];

        if (history.length === 0) {
            els.messages.innerHTML = `
                <div class="bob-chat-empty">
                    <p>${BOBS[currentBob].emoji} Hold the mic button and speak</p>
                </div>
            `;
            return;
        }

        els.messages.innerHTML = history.map(msg => {
            const cls = msg.role === 'user' ? 'bob-chat-msg--user' : 'bob-chat-msg--bot';
            const escaped = escapeHtml(msg.content);
            return `<div class="bob-chat-msg ${cls}">${escaped}</div>`;
        }).join('');

        // Scroll to bottom
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function handleClear() {
        histories[currentBob] = [];
        renderMessages();
        showToast(`${BOBS[currentBob].name} conversation cleared`, 'info');
    }

    // ========================================
    // Utilities
    // ========================================

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message, type) {
        if (window.QuickActions?.showToast) {
            window.QuickActions.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    // ========================================
    // Public API
    // ========================================

    return {
        init,
        getOpenAIKey,
        updateApiNotice
    };
})();
