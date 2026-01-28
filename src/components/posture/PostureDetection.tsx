import React, { useRef, useEffect, useState } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { analyzePosture } from '../../utils/postureAnalysis';
import type { PostureMetrics } from '../../utils/postureAnalysis';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Play, Pause } from 'lucide-react';

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
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedMetrics, setCapturedMetrics] = useState<PostureMetrics | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);

    // Setup Camera
    useEffect(() => {
        if (method === 'camera' && videoRef.current) {
            async function setupCamera() {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    });
                    if (videoRef.current) videoRef.current.srcObject = stream;
                } catch (err) {
                    console.error("Error accessing camera:", err);
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
    }, [method]);

    // Sync Canvas Size
    useEffect(() => {
        const syncCanvas = () => {
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.clientWidth;
                canvas.height = video.clientHeight;
            }
        };

        window.addEventListener('resize', syncCanvas);
        const interval = setInterval(syncCanvas, 1000); // Periodic check for layout changes
        return () => {
            window.removeEventListener('resize', syncCanvas);
            clearInterval(interval);
        };
    }, []);

    // Detection Loop
    useEffect(() => {
        let animationId: number;
        const runDetection = async () => {
            if (videoRef.current && videoRef.current.readyState >= 2 && !isPaused) {
                await detect(videoRef.current);
            }
            animationId = requestAnimationFrame(runDetection);
        };
        if (method) runDetection();
        return () => cancelAnimationFrame(animationId);
    }, [detect, method, isPaused]);

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
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: "8px 16px", borderRadius: 20, backdropFilter: 'blur(10px)', fontSize: 14 }}>
                    返回
                </button>
                {method && (
                    <button onClick={() => { setMethod(null); setVideoSrc(null); setIsPaused(false); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: "8px 16px", borderRadius: 20, backdropFilter: 'blur(10px)', fontSize: 14 }}>
                        重选模式
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {!method ? (
                    <motion.div
                        key="selector"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 flex flex-col items-center justify-center p-6 gap-6"
                    >
                        <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 20 }}>选择体态检测方式</h2>

                        <motion.div
                            whileTap={{ scale: 0.98 }}
                            className="premium-card"
                            style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                            onClick={() => setMethod('camera')}
                        >
                            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: 20, borderRadius: '50%' }}>
                                <Camera size={40} color="var(--primary)" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: 18, marginBottom: 4 }}>实时拍摄</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>使用前置摄像头进行实时分析</p>
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
                        className="flex-1 flex flex-col relative bg-black"
                    >
                        {/* Video Container - Aspect Ratio Box */}
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
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
                                    objectFit: 'contain',
                                    transform: method === 'camera' ? 'scaleX(-1)' : 'none'
                                }}
                            />

                            <canvas
                                ref={canvasRef}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: `translate(-50%, -50%) ${method === 'camera' ? 'scaleX(-1)' : ''}`,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    pointerEvents: 'none'
                                }}
                            />

                            {/* Scanning Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-10">
                                <div style={{
                                    width: '100%',
                                    height: '80%',
                                    border: '2px dashed rgba(255,255,255,0.2)',
                                    borderRadius: 24,
                                    position: 'relative'
                                }}>
                                    <motion.div
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                                        style={{
                                            position: 'absolute', left: 0, right: 0, height: 2,
                                            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                                            boxShadow: '0 0 15px var(--primary)'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center bg-gradient-to-t from-black/80 to-transparent">
                            {countdown !== null ? (
                                <div style={{ fontSize: 72, fontWeight: 800, color: 'white', textShadow: '0 0 20px rgba(0,0,0,0.5)' }}>{countdown}</div>
                            ) : (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                                    <p style={{ color: 'white', textAlign: 'center', opacity: 0.8, fontSize: 14 }}>
                                        {method === 'camera' ? "请保持身体在框内，且背景简洁" : "播放到体态清晰处点击分析"}
                                    </p>

                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
                                        {method === 'upload' && (
                                            <button
                                                className="glass"
                                                style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', color: 'white' }}
                                                onClick={() => setIsPaused(!isPaused)}
                                            >
                                                {isPaused ? <Play size={24} fill="white" /> : <Pause size={24} fill="white" />}
                                            </button>
                                        )}

                                        <button
                                            className="btn-primary"
                                            style={{ width: 80, height: 80, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                            onClick={handleCapture}
                                        >
                                            <Camera size={32} />
                                        </button>

                                        {method === 'upload' && (
                                            <div style={{ width: 56 }} /> // Spacer
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
