import React, { useRef, useEffect, useState } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { analyzePosture } from '../../utils/postureAnalysis';
import type { PostureMetrics } from '../../utils/postureAnalysis';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Pause, RotateCcw, Video, VideoOff, PlayCircle, StopCircle, RefreshCw, Activity, Scan } from 'lucide-react';

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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

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
    const [aspectRatio, setAspectRatio] = useState<number>(3 / 4); // Default 3:4

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Setup Camera with robust track handling
    useEffect(() => {
        if (method === 'camera' && videoRef.current) {
            let currentStream: MediaStream | null = null;

            async function setupCamera() {
                try {
                    // Explicitly stop all old tracks
                    const oldObject = videoRef.current?.srcObject;
                    if (oldObject instanceof MediaStream) {
                        oldObject.getTracks().forEach(t => t.stop());
                    }
                    if (videoRef.current) videoRef.current.srcObject = null;

                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: { ideal: facingMode },
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                    });

                    currentStream = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(e => console.warn("Cam play error", e));
                    }
                } catch (err) {
                    console.error("Camera access failed:", err);
                    alert("无法访问摄像头，请检查权限。");
                    setMethod(null);
                }
            }

            setupCamera();

            return () => {
                if (currentStream) {
                    currentStream.getTracks().forEach(track => track.stop());
                }
            };
        }
    }, [method, facingMode]);

    // Sync Canvas Resolution & Detect Aspect Ratio (PHYSICAL ALIGNMENT FIX)
    useEffect(() => {
        const syncMetaData = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && video.videoWidth > 0) {
                // 1. Calculate real aspect ratio for the wrapper
                const newRatio = video.videoWidth / video.videoHeight;
                setAspectRatio(newRatio);

                // 2. Set canvas internal pixels to 1:1 match video pixels
                if (canvas) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }
                console.log(`Resolution Synced: ${video.videoWidth}x${video.videoHeight}, Ratio: ${newRatio}`);
            }
        };

        const video = videoRef.current;
        if (video) {
            video.addEventListener('loadedmetadata', syncMetaData);
            video.addEventListener('play', syncMetaData);
            if (video.videoWidth > 0) syncMetaData();

            return () => {
                video.removeEventListener('loadedmetadata', syncMetaData);
                video.removeEventListener('play', syncMetaData);
            };
        }
    }, [method, videoSrc]);

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
        ctx.lineWidth = Math.max(3, ctx.canvas.width / 180);
        ctx.lineCap = 'round';
        ctx.shadowBlur = 12;
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
            // Start detecting if video is ready AND either playing OR paused (to support seek-to-analyze)
            if (video && video.readyState >= 2 && isDetecting) {
                try {
                    // If paused, we only analyze if the frame is different (handled by MediaPipe internal)
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
    }, [detect, method, isDetecting]);

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

    // Video Time Update with Seek Protection
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
                            style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer', padding: 30 }}
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
                            style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer', padding: 30 }}
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
                            position: 'relative',
                            maxHeight: 'calc(100vh - 240px)'
                        }}>
                            {/* Aspect Ratio Wrapper - ENSURES 1:1 PIXEL MATCHING */}
                            <div style={{
                                width: '100%',
                                maxWidth: '430px',
                                aspectRatio: `${aspectRatio}`,
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
                                        position: 'absolute', inset: 0,
                                        width: '100%', height: '100%',
                                        objectFit: 'cover', // Use cover inside the wrapper to fill exactly
                                        transform: (method === 'camera' && facingMode === 'user') ? 'scaleX(-1)' : 'none'
                                    }}
                                />

                                <canvas
                                    ref={canvasRef}
                                    style={{
                                        position: 'absolute', inset: 0,
                                        width: '100%', height: '100%',
                                        objectFit: 'cover', // MUST match video exactly
                                        transform: (method === 'camera' && facingMode === 'user') ? 'scaleX(-1)' : 'none',
                                        pointerEvents: 'none',
                                        zIndex: 5
                                    }}
                                />

                                {isDetecting && !isPaused && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                        <div style={{ width: '90%', height: '90%', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 20 }}>
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

                                {isRecording && (
                                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md z-20">
                                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">REC</span>
                                    </div>
                                )}

                                {countdown !== null && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-lg z-30">
                                        <motion.div
                                            key={countdown}
                                            initial={{ scale: 0.4, opacity: 0 }}
                                            animate={{ scale: 1.5, opacity: 1 }}
                                            style={{ fontSize: 80, fontWeight: 900, color: 'white' }}
                                        >
                                            {countdown > 0 ? countdown : "✓"}
                                        </motion.div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="safe-area-bottom" style={{
                            background: 'rgba(12, 12, 15, 0.98)',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            padding: '20px 20px 30px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16
                        }}>

                            {method === 'upload' && (
                                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 35 }}>{Math.floor(currentTime)}s</span>
                                    <input
                                        type="range" min={0} max={duration || 100} step={0.1}
                                        value={currentTime}
                                        onMouseDown={() => setIsSeeking(true)}
                                        onMouseUp={() => setIsSeeking(false)}
                                        onTouchStart={() => setIsSeeking(true)}
                                        onTouchEnd={() => setIsSeeking(false)}
                                        onChange={handleSeek}
                                        style={{ flex: 1, accentColor: 'var(--primary)', height: 3, cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 35 }}>{Math.floor(duration)}s</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                                    <button
                                        onClick={() => setIsDetecting(!isDetecting)}
                                        style={{
                                            flex: 1, background: isDetecting ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.05)',
                                            border: '1px solid ' + (isDetecting ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.08)'),
                                            color: isDetecting ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                                            padding: '12px 0', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5
                                        }}
                                    >
                                        {isDetecting ? <Activity size={18} /> : <VideoOff size={18} />}
                                        <span style={{ fontSize: 9, fontWeight: 700 }}>探测</span>
                                    </button>

                                    {method === 'camera' ? (
                                        <button
                                            onClick={() => setIsRecording(!isRecording)}
                                            style={{
                                                flex: 1, background: isRecording ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.05)',
                                                border: '1px solid ' + (isRecording ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)'),
                                                color: isRecording ? '#ef4444' : 'rgba(255,255,255,0.5)',
                                                padding: '12px 0', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5
                                            }}
                                        >
                                            {isRecording ? <StopCircle size={18} /> : <Video size={18} />}
                                            <span style={{ fontSize: 9, fontWeight: 700 }}>录制</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={togglePause}
                                            style={{
                                                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                                color: 'white', padding: '12px 0', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5
                                            }}
                                        >
                                            {isPaused ? <PlayCircle size={18} /> : <Pause size={18} />}
                                            <span style={{ fontSize: 9, fontWeight: 700 }}>{isPaused ? "播放" : "暂停"}</span>
                                        </button>
                                    )}
                                </div>

                                <div style={{ margin: '0 15px' }}>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        className="btn-primary"
                                        style={{ width: 68, height: 68, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)' }}
                                        onClick={handleCapture}
                                        disabled={countdown !== null}
                                    >
                                        <Scan size={30} />
                                    </motion.button>
                                </div>

                                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                    {method === 'camera' && (
                                        <button
                                            onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}
                                            style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setMethod(null); setVideoSrc(null); setIsPaused(false); setAspectRatio(3 / 4); }}
                                        style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                </div>
                            </div>

                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 5 }}>
                                {method === 'camera' ? "调整手机位置至身体成比例位于框内" : "拖动进度条寻找侧身最挺拔的一刻点击扫描"}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
