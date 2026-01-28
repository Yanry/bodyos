import React, { useRef, useEffect, useState } from 'react';
import { usePoseDetection } from '../../hooks/usePoseDetection';
import { analyzePosture } from '../../utils/postureAnalysis';
import type { PostureMetrics } from '../../utils/postureAnalysis';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';

interface Props {
    onComplete: (metrics: PostureMetrics) => void;
    onBack: () => void;
}

export const PostureDetection: React.FC<Props> = ({ onComplete, onBack }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { results, detect } = usePoseDetection();
    const [countdown, setCountdown] = useState<number | null>(null);
    const [capturedMetrics, setCapturedMetrics] = useState<PostureMetrics | null>(null);

    useEffect(() => {
        async function setupCamera() {
            if (videoRef.current) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                    });
                    videoRef.current.srcObject = stream;
                } catch (err) {
                    console.error("Error accessing camera:", err);
                }
            }
        }
        setupCamera();
    }, []);

    useEffect(() => {
        let animationId: number;
        const runDetection = async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
                await detect(videoRef.current);
            }
            animationId = requestAnimationFrame(runDetection);
        };
        runDetection();
        return () => cancelAnimationFrame(animationId);
    }, [detect]);

    const handleCapture = () => {
        if (results) {
            const metrics = analyzePosture(results);
            if (metrics) {
                setCapturedMetrics(metrics);
                setCountdown(3);
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
            className="flex-1 flex flex-col bg-black relative"
            style={{ height: '100vh' }}
        >
            <div className="absolute top-6 left-6 z-10">
                <button onClick={onBack} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: 8, borderRadius: '50%', cursor: 'pointer' }}>
                    ←
                </button>
            </div>

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />

            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />

            {/* Scanning Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div style={{
                    width: '80%', height: '70%',
                    border: '2px dashed rgba(255,255,255,0.3)',
                    borderRadius: 24,
                    position: 'relative'
                }}>
                    {/* Scanning Line Animation */}
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

            <div className="absolute bottom-10 left-0 right-0 p-6 flex flex-col items-center">
                {countdown !== null ? (
                    <div style={{ fontSize: 72, fontWeight: 800, color: 'white' }}>{countdown}</div>
                ) : (
                    <>
                        <p style={{ color: 'white', marginBottom: 20, textAlign: 'center', opacity: 0.8 }}>
                            请保持身体在框内，且背景简洁
                        </p>
                        <button
                            className="btn-primary"
                            style={{ width: 80, height: 80, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            onClick={handleCapture}
                        >
                            <Camera size={32} />
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
};
