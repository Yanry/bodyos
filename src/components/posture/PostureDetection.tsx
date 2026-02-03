import React, { useRef, useEffect, useState } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { analyzePosture } from '../../utils/postureAnalysis';
import type { PostureMetrics } from '../../utils/postureAnalysis';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Pause, RotateCcw, Video, VideoOff, PlayCircle, StopCircle, RefreshCw, Activity, Scan, AlertCircle } from 'lucide-react';

const TORSO = [[11, 12], [12, 24], [24, 23], [23, 11]];
const LEFT_ARM = [[11, 13], [13, 15]];
const RIGHT_ARM = [[12, 14], [14, 16]];
const LEFT_LEG = [[23, 25], [25, 27], [27, 29], [29, 31]];
const RIGHT_LEG = [[24, 26], [26, 28], [28, 30], [30, 32]];
const FACE = [[0, 1], [0, 4], [1, 2], [2, 3], [3, 7], [4, 5], [5, 6], [6, 8]];

// Landmarks to monitor for visibility/clipping
const CRITICAL_LANDMARKS = [0, 15, 16, 23, 24, 27, 28, 31, 32];

interface Props {
    onComplete: (metrics: PostureMetrics) => void;
    onBack: () => void;
}

export const PostureDetection: React.FC<Props> = ({ onComplete, onBack }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const lastVoiceRef = useRef<number>(0);

    const [method, setMethod] = useState<'camera' | 'upload' | null>(null);
    const { results, detect } = usePoseDetection();

    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [isDetecting, setIsDetecting] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isSeeking, setIsSeeking] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedMetrics, setCapturedMetrics] = useState<PostureMetrics | null>(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Frame alert state
    const [frameAlert, setFrameAlert] = useState<string | null>(null);

    // Setup Camera with robust track handling and state lock
    useEffect(() => {
        if (method === 'camera' && videoRef.current) {
            let currentStream: MediaStream | null = null;
            let isActive = true;

            const setupCamera = async () => {
                const oldStream = videoRef.current?.srcObject;
                if (oldStream instanceof MediaStream) {
                    oldStream.getTracks().forEach(t => t.stop());
                }
                if (videoRef.current) videoRef.current.srcObject = null;

                const constraints = [
                    {
                        video: {
                            facingMode: { ideal: facingMode },
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        }
                    },
                    {
                        video: { facingMode: facingMode }
                    },
                    { video: true }
                ];

                let stream: MediaStream | null = null;
                let lastError: any = null;

                for (const constraint of constraints) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(constraint);
                        if (stream) break;
                    } catch (err) {
                        lastError = err;
                        console.warn(`Constraint failed, trying next...`, constraint, err);
                    }
                }

                if (!stream) {
                    console.error("All camera constraints failed:", lastError);
                    if (isActive) {
                        alert("无法访问摄像头，请确保您已授予权限且摄像头未被其他程序占用。");
                        setMethod(null);
                    }
                    return;
                }

                if (!isActive) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                currentStream = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.warn("Camera play failed", e));
                }
            };

            setupCamera();

            return () => {
                isActive = false;
                if (currentStream) {
                    currentStream.getTracks().forEach(track => track.stop());
                }
            };
        }
    }, [method, facingMode]);

    // Sync Canvas Internal Resolution to Video (1:1 PIXEL MATCHING)
    useEffect(() => {
        const syncRes = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                console.log(`Canvas Resolution Reset: ${canvas.width}x${canvas.height}`);
            }
        };

        const video = videoRef.current;
        if (video) {
            video.addEventListener('loadedmetadata', syncRes);
            video.addEventListener('play', syncRes);
            if (video.videoWidth > 0) syncRes();

            return () => {
                video.removeEventListener('loadedmetadata', syncRes);
                video.removeEventListener('play', syncRes);
            };
        }
    }, [method, videoSrc]);

    // UI Feedback & Direction Logic
    useEffect(() => {
        if (!results?.poseLandmarks || !isDetecting || isPaused) {
            setFrameAlert(null);
            return;
        }

        const landmarks = results.poseLandmarks;
        let alertMsg: string | null = null;
        let outCount = 0;

        // Boundary checks
        const head = landmarks[0];
        const feet = [landmarks[31], landmarks[32], landmarks[27], landmarks[28]];
        const leftSide = [landmarks[11], landmarks[13], landmarks[15], landmarks[23], landmarks[25]];
        const rightSide = [landmarks[12], landmarks[14], landmarks[16], landmarks[24], landmarks[26]];

        const isLowVisibility = CRITICAL_LANDMARKS.some(idx => {
            const l = landmarks[idx];
            return !l || l.visibility === undefined || l.visibility < 0.55;
        });

        if (head && head.y < 0.05) { alertMsg = "请向下移动或后退"; outCount++; }
        else if (feet.some(f => f && f.y > 0.95)) { alertMsg = "请向上移动或后退"; outCount++; }
        else if (leftSide.some(s => s && s.x < 0.05)) { alertMsg = facingMode === 'user' ? "请向左移动" : "请向右移动"; outCount++; }
        else if (rightSide.some(s => s && s.x > 0.95)) { alertMsg = facingMode === 'user' ? "请向右移动" : "请向左移动"; outCount++; }
        else if (isLowVisibility) { alertMsg = "请向后退，确保全身入镜"; outCount++; }

        if (outCount > 1) alertMsg = "请向后退，让全身完全入镜";

        setFrameAlert(alertMsg);

        // Voice Alert (Throttle 10s)
        if (alertMsg && Date.now() - lastVoiceRef.current > 10000) {
            const speech = new SpeechSynthesisUtterance(alertMsg);
            speech.lang = 'zh-CN';
            speech.rate = 1.1;
            window.speechSynthesis.cancel(); // Clear previous
            window.speechSynthesis.speak(speech);
            lastVoiceRef.current = Date.now();
        }
    }, [results, isDetecting, isPaused, facingMode]);

    // Recording Logic
    useEffect(() => {
        if (isRecording && videoRef.current?.srcObject) {
            try {
                const stream = videoRef.current.srcObject as MediaStream;
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                mediaRecorderRef.current = recorder;
                recordedChunksRef.current = [];

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) recordedChunksRef.current.push(e.data);
                };

                recorder.onstop = () => {
                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `jiyi_recording_${Date.now()}.webm`;
                    a.click();
                    URL.revokeObjectURL(url);
                };

                recorder.start();
            } catch (e) {
                console.error("Recording start failed", e);
                setIsRecording(false);
            }
        } else {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        }
    }, [isRecording]);

    // Drawing Helper
    const drawLine = (ctx: CanvasRenderingContext2D, landmarks: any, connections: number[][], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, ctx.canvas.width / 200);
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;

        connections.forEach(([i, j]) => {
            const p1 = landmarks[i];
            const p2 = landmarks[j];
            if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
                ctx.beginPath();
                ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
                ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
                ctx.stroke();
            }
        });
        ctx.shadowBlur = 0;
    };

    // Drawing Loop
    useEffect(() => {
        if (canvasRef.current && results?.poseLandmarks && isDetecting) {
            const canvasCtx = canvasRef.current.getContext('2d');
            if (!canvasCtx) return;

            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            const landmarks = results.poseLandmarks;

            drawLine(canvasCtx, landmarks, TORSO, '#3b82f6');
            drawLine(canvasCtx, landmarks, LEFT_ARM, '#10b981');
            drawLine(canvasCtx, landmarks, RIGHT_ARM, '#10b981');
            drawLine(canvasCtx, landmarks, LEFT_LEG, '#f59e0b');
            drawLine(canvasCtx, landmarks, RIGHT_LEG, '#f59e0b');
            drawLine(canvasCtx, landmarks, FACE, '#ec4899');

            canvasCtx.fillStyle = 'white';
            landmarks.forEach((p: any) => {
                if (p.visibility > 0.5) {
                    canvasCtx.beginPath();
                    canvasCtx.arc(p.x * canvasCtx.canvas.width, p.y * canvasCtx.canvas.height, Math.max(2, canvasCtx.canvas.width / 250), 0, 2 * Math.PI);
                    canvasCtx.fill();
                }
            });
        } else if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, [results, isDetecting]);

    // Detection Loop
    useEffect(() => {
        let animationId: number;
        let isActive = true;

        const runDetection = async () => {
            if (!isActive) return;
            const video = videoRef.current;
            if (video && video.readyState >= 2 && isDetecting && !isPaused) {
                try {
                    await detect(video);
                } catch (e) {
                    console.error("Detection failure", e);
                }
            }
            if (isActive) {
                animationId = requestAnimationFrame(runDetection);
            }
        };

        if (method) animationId = requestAnimationFrame(runDetection);

        return () => {
            isActive = false;
            cancelAnimationFrame(animationId);
        };
    }, [detect, method, isDetecting, isPaused]);

    const togglePause = () => {
        const video = videoRef.current;
        if (video) {
            if (video.paused) {
                video.play().catch(console.error);
                setIsPaused(false);
            } else {
                video.pause();
                setIsPaused(true);
            }
        }
    };

    // Progress Bar Logic
    useEffect(() => {
        const video = videoRef.current;
        if (video && method === 'upload') {
            const update = () => {
                if (!isSeeking) {
                    setCurrentTime(video.currentTime);
                    setDuration(video.duration);
                }
            };
            video.addEventListener('timeupdate', update);
            video.addEventListener('loadedmetadata', update);
            return () => {
                video.removeEventListener('timeupdate', update);
                video.removeEventListener('loadedmetadata', update);
            };
        }
    }, [method, videoSrc, isSeeking]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (video) {
            const time = parseFloat(e.target.value);
            video.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleCapture = () => {
        if (results) {
            const metrics = analyzePosture(results);
            if (metrics) {
                setCapturedMetrics(metrics);
                setCountdown(3);
                if (method === 'upload') {
                    videoRef.current?.pause();
                    setIsPaused(true);
                }
            }
        }
    };

    useEffect(() => {
        if (countdown !== null && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            if (capturedMetrics) onComplete(capturedMetrics);
        }
    }, [countdown, capturedMetrics, onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col bg-black relative overflow-hidden"
            style={{ height: '100vh', width: '100%' }}
        >
            {/* Top Bar */}
            <div className="z-30 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onBack} className="glass" style={{ border: 'none', color: 'white', padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: 'pointer' }}>
                    返回
                </button>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                    {!method ? "体态检测" : method === 'camera' ? "实时拍摄" : "录像分析"}
                </h2>
                <div style={{ width: 60 }} />
            </div>

            <AnimatePresence mode="wait">
                {!method ? (
                    <motion.div
                        key="selector"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 flex flex-col items-center justify-center p-6 gap-6"
                    >
                        <motion.div
                            whileTap={{ scale: 0.98 }}
                            className="premium-card"
                            style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer', padding: 32 }}
                            onClick={() => { setMethod('camera'); setIsDetecting(true); }}
                        >
                            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: 24, borderRadius: '50%' }}>
                                <Camera size={44} color="var(--primary)" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: 20, marginBottom: 4 }}>实时拍摄</h3>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>使用设备摄像头进行实时分析</p>
                            </div>
                        </motion.div>

                        <motion.div
                            whileTap={{ scale: 0.98 }}
                            className="premium-card"
                            style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer', padding: 32 }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 24, borderRadius: '50%' }}>
                                <Upload size={44} color="var(--secondary)" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: 20, marginBottom: 4 }}>上传视频</h3>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>从本地相册选择录像文件</p>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setVideoSrc(URL.createObjectURL(file));
                                        setMethod('upload');
                                        setIsDetecting(true);
                                        setIsPaused(false);
                                    }
                                }}
                                accept="video/*"
                                style={{ display: 'none' }}
                            />
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="display"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col relative"
                    >
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px 16px 140px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                borderRadius: 24,
                                overflow: 'hidden',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                transform: (method === 'camera' && facingMode === 'user') ? 'scaleX(-1)' : 'none'
                            }}>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    loop={method === 'upload'}
                                    src={videoSrc || undefined}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        display: 'block'
                                    }}
                                />

                                <canvas
                                    ref={canvasRef}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        pointerEvents: 'none',
                                        zIndex: 10
                                    }}
                                />

                                {isDetecting && !isPaused && !frameAlert && (
                                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
                                        <motion.div
                                            animate={{ top: ['0%', '100%', '0%'] }}
                                            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                                            style={{
                                                position: 'absolute', left: 0, right: 0, height: 2,
                                                background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                                                boxShadow: '0 0 15px var(--primary)'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* REC Indicator */}
                            {isRecording && (
                                <div style={{ position: 'absolute', top: 20, right: 30, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: 20, backdropFilter: 'blur(10px)', zIndex: 40 }}>
                                    <div style={{ width: 10, height: 10, background: '#ef4444', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>REC</span>
                                </div>
                            )}

                            {/* Frame Warning Overlay */}
                            <AnimatePresence>
                                {frameAlert && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        style={{
                                            position: 'absolute',
                                            bottom: 160,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'rgba(239, 68, 68, 0.9)',
                                            padding: '12px 24px',
                                            borderRadius: 16,
                                            backdropFilter: 'blur(10px)',
                                            color: 'white',
                                            zIndex: 45,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
                                            width: 'auto',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <AlertCircle size={20} />
                                        <span style={{ fontWeight: 700, fontSize: 16 }}>{frameAlert}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Countdown Overlay */}
                            {countdown !== null && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 50 }}>
                                    <motion.div
                                        key={countdown}
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1.5, opacity: 1 }}
                                        style={{ fontSize: 100, fontWeight: 900, color: 'white' }}
                                    >
                                        {countdown > 0 ? countdown : "✓"}
                                    </motion.div>
                                </div>
                            )}
                        </div>

                        {/* Bottom Floating Controls */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(10, 10, 12, 0.98)',
                            backdropFilter: 'blur(20px)',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
                            zIndex: 40,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16
                        }}>
                            {/* Progress bar for upload mode */}
                            {method === 'upload' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 35 }}>{Math.floor(currentTime)}s</span>
                                    <input
                                        type="range" min={0} max={duration || 100} step={0.1}
                                        value={currentTime}
                                        onMouseDown={() => setIsSeeking(true)}
                                        onMouseUp={() => setIsSeeking(false)}
                                        onTouchStart={() => setIsSeeking(true)}
                                        onTouchEnd={() => setIsSeeking(false)}
                                        onChange={handleSeek}
                                        style={{ flex: 1, accentColor: 'var(--primary)', height: 4, cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 35 }}>{Math.floor(duration)}s</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                                    <button
                                        onClick={() => setIsDetecting(!isDetecting)}
                                        style={{
                                            flex: 1, height: 48, borderRadius: 14,
                                            background: isDetecting ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                                            border: '1px solid ' + (isDetecting ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.1)'),
                                            color: isDetecting ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer'
                                        }}
                                    >
                                        {isDetecting ? <Activity size={18} /> : <VideoOff size={18} />}
                                        <span style={{ fontSize: 10, fontWeight: 700 }}>探测</span>
                                    </button>

                                    {method === 'camera' ? (
                                        <button
                                            onClick={() => setIsRecording(!isRecording)}
                                            style={{
                                                flex: 1, height: 48, borderRadius: 14,
                                                background: isRecording ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                                                border: '1px solid ' + (isRecording ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.1)'),
                                                color: isRecording ? '#ef4444' : 'rgba(255,255,255,0.5)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer'
                                            }}
                                        >
                                            {isRecording ? <StopCircle size={18} /> : <Video size={18} />}
                                            <span style={{ fontSize: 10, fontWeight: 700 }}>录像</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={togglePause}
                                            style={{
                                                flex: 1, height: 48, borderRadius: 14,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer'
                                            }}
                                        >
                                            {isPaused ? <PlayCircle size={18} /> : <Pause size={18} />}
                                            <span style={{ fontSize: 10, fontWeight: 700 }}>{isPaused ? "播放" : "暂停"}</span>
                                        </button>
                                    )}
                                </div>

                                <div style={{ padding: '0 20px', position: 'relative' }}>
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handleCapture}
                                        disabled={countdown !== null}
                                        style={{
                                            width: 72, height: 72, borderRadius: '50%', border: 'none',
                                            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', zIndex: 10
                                        }}
                                    >
                                        <Scan size={32} color="white" />
                                    </motion.button>
                                    <p style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', marginTop: 8, color: 'var(--text-secondary)' }}>分析当前</p>
                                </div>

                                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                    {method === 'camera' && (
                                        <button
                                            onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}
                                            style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setMethod(null); setVideoSrc(null); setIsPaused(false); window.speechSynthesis.cancel(); }}
                                        style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    >
                                        <RotateCcw size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
