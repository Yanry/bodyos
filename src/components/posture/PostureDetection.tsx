import React, { useRef, useEffect, useState } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { analyzePosture } from '../../utils/postureAnalysis';
import type { PostureMetrics } from '../../utils/postureAnalysis';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Pause, RotateCcw, Video, VideoOff, PlayCircle, StopCircle, RefreshCw, Activity } from 'lucide-react';

const TORSO = [[11, 12], [12, 24], [24, 23], [23, 11]];
const LEFT_ARM = [[11, 13], [13, 15]];
const RIGHT_ARM = [[12, 14], [14, 16]];
const LEFT_LEG = [[23, 25], [25, 27], [27, 29], [29, 31]];
const RIGHT_LEG = [[24, 26], [26, 28], [28, 30], [30, 32]];
const FACE = [[0, 1], [0, 4], [1, 2], [2, 3], [3, 7], [4, 5], [5, 6], [6, 8]];

interface Props {
    onComplete: (metrics: PostureMetrics) => void;
    onBack: () => void;
}

export const PostureDetection: React.FC<Props> = ({ onComplete, onBack }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [method, setMethod] = useState<'camera' | 'upload' | null>(null);
    const { results, detect } = usePoseDetection();

    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [isDetecting, setIsDetecting] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedMetrics, setCapturedMetrics] = useState<PostureMetrics | null>(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Setup Camera
    useEffect(() => {
        if (method === 'camera' && videoRef.current) {
            async function setupCamera() {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: facingMode,
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                    });
                    if (videoRef.current) videoRef.current.srcObject = stream;
                } catch (err) {
                    console.error("无法访问摄像头:", err);
                    setMethod(null);
                }
            }
            setupCamera();
            return () => {
                if (videoRef.current?.srcObject) {
                    (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                }
            };
        }
    }, [method, facingMode]);

    // Sync Canvas Internal Resolution to Video Source
    useEffect(() => {
        const syncRes = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
        };

        const video = videoRef.current;
        if (video) {
            video.addEventListener('loadedmetadata', syncRes);
            video.addEventListener('play', syncRes);
            return () => {
                video.removeEventListener('loadedmetadata', syncRes);
                video.removeEventListener('play', syncRes);
            };
        }
    }, [method, videoSrc]);

    // Drawing Helper
    const drawLine = (ctx: CanvasRenderingContext2D, landmarks: any, connections: number[][], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, ctx.canvas.width / 200);
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
                    canvasCtx.arc(p.x * canvasCtx.canvas.width, p.y * canvasCtx.canvas.height, Math.max(1, canvasCtx.canvas.width / 300), 0, 2 * Math.PI);
                    canvasCtx.fill();
                }
            });
        } else if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, [results, isDetecting]);

    // Detection Loop - Resilient to pause and stop
    useEffect(() => {
        let animationId: number;
        let isActive = true;

        const runDetection = async () => {
            if (!isActive) return;

            const video = videoRef.current;
            if (video && video.readyState >= 2 && !isPaused && isDetecting) {
                try {
                    await detect(video);
                } catch (e) {
                    console.error("Detection error in loop", e);
                }
            }

            if (isActive) {
                animationId = requestAnimationFrame(runDetection);
            }
        };

        if (method) {
            animationId = requestAnimationFrame(runDetection);
        }

        return () => {
            isActive = false;
            cancelAnimationFrame(animationId);
        };
    }, [detect, method, isPaused, isDetecting]);

    // Video Actions
    const togglePause = () => {
        const video = videoRef.current;
        if (video) {
            if (isPaused) {
                video.play().catch(console.error);
                setIsPaused(false);
            } else {
                video.pause();
                setIsPaused(true);
            }
        }
    };

    // Progress update
    useEffect(() => {
        const video = videoRef.current;
        if (video && method === 'upload') {
            const update = () => {
                setCurrentTime(video.currentTime);
                setDuration(video.duration);
            };
            video.addEventListener('timeupdate', update);
            video.addEventListener('loadedmetadata', update);
            return () => {
                video.removeEventListener('timeupdate', update);
                video.removeEventListener('loadedmetadata', update);
            };
        }
    }, [method, videoSrc]);

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

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (video) {
            const time = parseFloat(e.target.value);
            video.currentTime = time;
            setCurrentTime(time);
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
            <div className="z-20 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onBack} className="glass" style={{ border: 'none', color: 'white', padding: "8px 16px", borderRadius: 20, fontSize: 13 }}>
                    返回
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
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
                            style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                            onClick={() => { setMethod('camera'); setIsDetecting(true); }}
                        >
                            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: 20, borderRadius: '50%' }}>
                                <Camera size={40} color="var(--primary)" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: 18, marginBottom: 4 }}>实时拍摄</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>使用前后摄像头进行实时分析</p>
                            </div>
                        </motion.div>

                        <motion.div
                            whileTap={{ scale: 0.98 }}
                            className="premium-card"
                            style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 20, borderRadius: '50%' }}>
                                <Upload size={40} color="var(--secondary)" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: 18, marginBottom: 4 }}>上传视频</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>从相册选择已录制的体态视频</p>
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
                        className="flex-1 flex flex-col"
                    >
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '0 16px',
                            position: 'relative'
                        }}>
                            <div style={{
                                width: '100%',
                                maxWidth: '430px',
                                aspectRatio: '3/4',
                                background: '#000',
                                borderRadius: 24,
                                overflow: 'hidden',
                                position: 'relative',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    loop={method === 'upload'}
                                    src={videoSrc || undefined}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        transform: (method === 'camera' && facingMode === 'user') ? 'scaleX(-1)' : 'none'
                                    }}
                                />

                                <canvas
                                    ref={canvasRef}
                                    style={{
                                        position: 'absolute',
                                        top: 0, left: 0,
                                        width: '100%', height: '100%',
                                        objectFit: 'contain', // Match video object-fit
                                        transform: (method === 'camera' && facingMode === 'user') ? 'scaleX(-1)' : 'none',
                                        pointerEvents: 'none'
                                    }}
                                />

                                {isDetecting && !isPaused && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <div style={{ width: '85%', height: '85%', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 20 }}>
                                            <motion.div
                                                animate={{ top: ['5%', '95%', '5%'] }}
                                                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                                                style={{
                                                    position: 'absolute', left: '5%', right: '5%', height: 1.5,
                                                    background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                                                    boxShadow: '0 0 15px var(--primary)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {countdown !== null && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md">
                                        <motion.div
                                            key={countdown}
                                            initial={{ scale: 0.4, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            style={{ fontSize: 120, fontWeight: 900, color: 'white' }}
                                        >
                                            {countdown > 0 ? countdown : "✓"}
                                        </motion.div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="safe-area-bottom" style={{
                            background: 'rgba(10, 10, 12, 0.98)',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            padding: '24px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 20
                        }}>

                            {method === 'upload' && (
                                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 30 }}>{Math.floor(currentTime)}s</span>
                                    <input
                                        type="range" min={0} max={duration || 100} step={0.1}
                                        value={currentTime} onChange={handleSeek}
                                        style={{ flex: 1, accentColor: 'var(--primary)', height: 3, cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 30 }}>{Math.floor(duration)}s</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                                    <button
                                        onClick={() => setIsDetecting(!isDetecting)}
                                        style={{
                                            flex: 1, background: isDetecting ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                                            border: '1px solid ' + (isDetecting ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.1)'),
                                            color: isDetecting ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
                                            padding: '12px 6px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                                        }}
                                    >
                                        {isDetecting ? <Activity size={18} /> : <VideoOff size={18} />}
                                        <span style={{ fontSize: 10, fontWeight: 600 }}>{isDetecting ? "关检测" : "开检测"}</span>
                                    </button>

                                    {method === 'camera' ? (
                                        <button
                                            onClick={() => setIsRecording(!isRecording)}
                                            style={{
                                                flex: 1, background: isRecording ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                                                border: '1px solid ' + (isRecording ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.1)'),
                                                color: isRecording ? '#ef4444' : 'rgba(255,255,255,0.6)',
                                                padding: '12px 6px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                                            }}
                                        >
                                            {isRecording ? <StopCircle size={18} /> : <Video size={18} />}
                                            <span style={{ fontSize: 10, fontWeight: 600 }}>{isRecording ? "停录制" : "开录制"}</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={togglePause}
                                            style={{
                                                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', padding: '12px 6px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                                            }}
                                        >
                                            {isPaused ? <PlayCircle size={18} /> : <Pause size={18} />}
                                            <span style={{ fontSize: 10, fontWeight: 600 }}>{isPaused ? "播放" : "暂停"}</span>
                                        </button>
                                    )}
                                </div>

                                <div style={{ margin: '0 20px' }}>
                                    <button
                                        className="btn-primary"
                                        style={{ width: 68, height: 68, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)' }}
                                        onClick={handleCapture}
                                        disabled={countdown !== null}
                                    >
                                        <Camera size={28} />
                                    </button>
                                    <p style={{ fontSize: 10, textAlign: 'center', marginTop: 8, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>分析当前</p>
                                </div>

                                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                    {method === 'camera' && (
                                        <button
                                            onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}
                                            style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setMethod(null); setVideoSrc(null); setIsPaused(false); }}
                                        style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                </div>
                            </div>

                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: '0.02em' }}>
                                {method === 'camera' ? "确保身体完整入镜，由系统捕捉核心支点" : "请暂停在体态展示最清晰的一帧，点击进行深度分析"}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
