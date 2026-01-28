import React, { useRef, useEffect, useState } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { analyzePosture } from '../../utils/postureAnalysis';
import type { PostureMetrics } from '../../utils/postureAnalysis';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Pause, RotateCcw, Video, VideoOff, PlayCircle, StopCircle, RefreshCw, Activity } from 'lucide-react';
import { POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

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

    // States for new features
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [isDetecting, setIsDetecting] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedMetrics, setCapturedMetrics] = useState<PostureMetrics | null>(null);

    // Progress bar states
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

    // Sync Canvas Size
    useEffect(() => {
        const syncCanvas = () => {
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const rect = video.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        };

        window.addEventListener('resize', syncCanvas);
        const interval = setInterval(syncCanvas, 1000);
        return () => {
            window.removeEventListener('resize', syncCanvas);
            clearInterval(interval);
        };
    }, []);

    // Drawing Loop
    useEffect(() => {
        if (canvasRef.current && results?.poseLandmarks && isDetecting) {
            const canvasCtx = canvasRef.current.getContext('2d');
            if (!canvasCtx) return;

            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            const video = videoRef.current;
            if (video) {
                // Draw skeleton
                drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                    { color: 'rgba(59, 130, 246, 0.8)', lineWidth: 4 });
                drawLandmarks(canvasCtx, results.poseLandmarks,
                    { color: '#ffffff', lineWidth: 1, radius: 2 });
            }
        } else if (canvasRef.current && !isDetecting) {
            const canvasCtx = canvasRef.current.getContext('2d');
            canvasCtx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, [results, isDetecting]);

    // Detection Loop
    useEffect(() => {
        let animationId: number;
        const runDetection = async () => {
            if (videoRef.current && videoRef.current.readyState >= 2 && !isPaused && isDetecting) {
                await detect(videoRef.current);
            }
            animationId = requestAnimationFrame(runDetection);
        };
        if (method) runDetection();
        return () => cancelAnimationFrame(animationId);
    }, [detect, method, isPaused, isDetecting]);

    // Video Progress Update
    useEffect(() => {
        const video = videoRef.current;
        if (video && method === 'upload') {
            const updateProgress = () => {
                setCurrentTime(video.currentTime);
                setDuration(video.duration);
            };
            video.addEventListener('timeupdate', updateProgress);
            video.addEventListener('loadedmetadata', updateProgress);
            return () => {
                video.removeEventListener('timeupdate', updateProgress);
                video.removeEventListener('loadedmetadata', updateProgress);
            };
        }
    }, [method, videoSrc]);

    const handleCapture = () => {
        if (results) {
            const metrics = analyzePosture(results);
            if (metrics) {
                setCapturedMetrics(metrics);
                setCountdown(3);
                if (method === 'upload') setIsPaused(true);
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setMethod('upload');
            setIsDetecting(true);
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

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col bg-black relative overflow-hidden"
            style={{ height: '100vh', width: '100%' }}
        >
            {/* Header */}
            <div className="z-20 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onBack} className="glass" style={{ border: 'none', color: 'white', padding: "8px 16px", borderRadius: 20, fontSize: 14 }}>
                    返回
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
                    {!method ? "体态检测" : method === 'camera' ? "实时拍摄" : "录像分析"}
                </h2>
                <div style={{ width: 60 }} /> {/* Spacer */}
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
                                onChange={handleFileUpload}
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
                        {/* Video Box (Framed) */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '0 20px',
                            position: 'relative'
                        }}>
                            <div style={{
                                width: '100%',
                                maxWidth: '430px', // Mobile width
                                aspectRatio: '3/4', // Modern mobile ratio
                                background: '#111',
                                borderRadius: 24,
                                overflow: 'hidden',
                                position: 'relative',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.1)'
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
                                        objectFit: 'cover',
                                        transform: (method === 'camera' && facingMode === 'user') ? 'scaleX(-1)' : 'none'
                                    }}
                                />

                                <canvas
                                    ref={canvasRef}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        width: '100%',
                                        height: '100%',
                                        transform: (method === 'camera' && facingMode === 'user') ? 'scaleX(-1)' : 'none',
                                        pointerEvents: 'none'
                                    }}
                                />

                                {/* Scanning Overlay */}
                                {isDetecting && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <div style={{
                                            width: '80%',
                                            height: '80%',
                                            border: '1px dashed rgba(255,255,255,0.3)',
                                            borderRadius: 16,
                                            position: 'relative'
                                        }}>
                                            <motion.div
                                                animate={{ top: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                                style={{
                                                    position: 'absolute', left: 0, right: 0, height: 1,
                                                    background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                                                    boxShadow: '0 0 10px var(--primary)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Countdown Overlay */}
                                {countdown !== null && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                        <motion.div
                                            key={countdown}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            style={{ fontSize: 100, fontWeight: 800, color: 'white' }}
                                        >
                                            {countdown > 0 ? countdown : "✓"}
                                        </motion.div>
                                    </div>
                                )}
                            </div>

                            {/* Method Label */}
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                <span style={{ fontSize: 12, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-secondary)' }}>
                                    {method === 'camera' ? (facingMode === 'user' ? "前置摄像头" : "后置摄像头") : "录像文件"}
                                </span>
                                {isRecording && (
                                    <span style={{ fontSize: 12, padding: '4px 8px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: 8, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> 录制中
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Control Panel (Bottom) */}
                        <div className="safe-area-bottom" style={{
                            background: 'rgba(18, 18, 22, 0.95)',
                            borderTop: '1px solid var(--border)',
                            padding: '24px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 20
                        }}>

                            {/* Progress Bar (Only for Upload) */}
                            {method === 'upload' && (
                                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 35 }}>{Math.floor(currentTime)}s</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={duration || 100}
                                        value={currentTime}
                                        onChange={handleSeek}
                                        style={{ flex: 1, accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 35 }}>{Math.floor(duration)}s</span>
                                </div>
                            )}

                            {/* Functional Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                                    {/* Toggle Analysis */}
                                    <button
                                        onClick={() => setIsDetecting(!isDetecting)}
                                        style={{
                                            flex: 1, background: isDetecting ? 'rgba(59, 130, 246, 0.2)' : 'var(--card)',
                                            border: '1px solid ' + (isDetecting ? 'var(--primary)' : 'var(--border)'),
                                            color: isDetecting ? 'var(--primary)' : 'white',
                                            padding: '12px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                                        }}
                                    >
                                        {isDetecting ? <Activity size={20} /> : <VideoOff size={20} />}
                                        <span style={{ fontSize: 11 }}>{isDetecting ? "停止检测" : "开启检测"}</span>
                                    </button>

                                    {/* Toggle Recording (Only for Camera) */}
                                    {method === 'camera' && (
                                        <button
                                            onClick={() => setIsRecording(!isRecording)}
                                            style={{
                                                flex: 1, background: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'var(--card)',
                                                border: '1px solid ' + (isRecording ? '#ef4444' : 'var(--border)'),
                                                color: isRecording ? '#ef4444' : 'white',
                                                padding: '12px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                                            }}
                                        >
                                            {isRecording ? <StopCircle size={20} /> : <Video size={20} />}
                                            <span style={{ fontSize: 11 }}>{isRecording ? "停止录像" : "开始录像"}</span>
                                        </button>
                                    )}

                                    {/* Back/Reselect for Upload */}
                                    {method === 'upload' && (
                                        <button
                                            onClick={() => setIsPaused(!isPaused)}
                                            style={{
                                                flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
                                                color: 'white', padding: '12px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                                            }}
                                        >
                                            {isPaused ? <PlayCircle size={20} /> : <Pause size={20} />}
                                            <span style={{ fontSize: 11 }}>{isPaused ? "继续播放" : "暂停播放"}</span>
                                        </button>
                                    )}
                                </div>

                                {/* Main Capture Button */}
                                <div style={{ margin: '0 24px' }}>
                                    <button
                                        className="btn-primary"
                                        style={{ width: 72, height: 72, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
                                        onClick={handleCapture}
                                        disabled={countdown !== null}
                                    >
                                        <Camera size={32} />
                                    </button>
                                    <p style={{ fontSize: 11, textAlign: 'center', marginTop: 8, color: 'var(--text-secondary)' }}>分析当前</p>
                                </div>

                                {/* Secondary Actions */}
                                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                    {method === 'camera' && (
                                        <button
                                            onClick={toggleCamera}
                                            style={{
                                                width: 48, height: 48, borderRadius: 12, background: 'var(--card)',
                                                border: '1px solid var(--border)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center'
                                            }}
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => { setMethod(null); setVideoSrc(null); }}
                                        style={{
                                            width: 48, height: 48, borderRadius: 12, background: 'var(--card)',
                                            border: '1px solid var(--border)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center'
                                        }}
                                    >
                                        <RotateCcw size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Hint */}
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                                {method === 'camera' ? "确保全身入镜，拍摄后生成报告" : "拖动进度条或播放视频，选择清晰帧拍摄"}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
