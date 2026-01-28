import { useRef, useEffect, useState } from 'react';
import type { Results, Options } from '@mediapipe/pose';
import { Pose } from '@mediapipe/pose';

export const usePoseDetection = (options: Options = {}) => {
    const [results, setResults] = useState<Results | null>(null);
    const poseRef = useRef<Pose | null>(null);

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
            setResults(res);
        });

        poseRef.current = pose;

        return () => {
            pose.close();
        };
    }, []);

    const detect = async (videoElement: HTMLVideoElement) => {
        if (poseRef.current) {
            await poseRef.current.send({ image: videoElement });
        }
    };

    return { results, detect };
};
