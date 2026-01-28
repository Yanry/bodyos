import { useRef, useEffect, useState } from 'react';
import type { Results, Options } from '@mediapipe/pose';
import { Pose } from '@mediapipe/pose';

export const usePoseDetection = (options: Options = {}) => {
    const [results, setResults] = useState<Results | null>(null);
    const isProcessing = useRef(false);
    const poseRef = useRef<Pose | null>(null);
    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        const pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            },
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            ...options
        });

        pose.onResults((res) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (isProcessing.current) {
                setResults(res);
            }
            isProcessing.current = false;
        });

        poseRef.current = pose;

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (poseRef.current) {
                poseRef.current.close();
                poseRef.current = null;
            }
        };
    }, []);

    const detect = async (videoElement: HTMLVideoElement) => {
        if (poseRef.current && !isProcessing.current) {
            isProcessing.current = true;

            // Safety timeout: Reset processing flag if model hangs
            timeoutRef.current = setTimeout(() => {
                isProcessing.current = false;
            }, 600);

            try {
                await poseRef.current.send({ image: videoElement });
            } catch (err) {
                console.error("Pose detection error:", err);
                isProcessing.current = false;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
        }
    };

    return { results, detect };
};
