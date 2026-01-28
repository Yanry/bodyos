import type { Results } from '@mediapipe/pose';

export interface PostureMetrics {
    shoulderAngle: number;
    pelvicAngle: number;
    roundShoulderIndex: number;
    score: number;
    issues: string[];
}

export const analyzePosture = (results: Results): PostureMetrics | null => {
    if (!results.poseLandmarks) return null;

    const lm = results.poseLandmarks;
    const issues: string[] = [];

    // 1. Shoulder Level (Front view)
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const shoulderAngle = Math.atan2(leftShoulder.y - rightShoulder.y, leftShoulder.x - rightShoulder.x) * (180 / Math.PI);

    if (Math.abs(shoulderAngle) > 3) {
        issues.push(shoulderAngle > 0 ? "左肩偏高" : "右肩偏高");
    }

    // 2. Pelvic Level (Front view)
    const leftHip = lm[23];
    const rightHip = lm[24];
    const pelvicAngle = Math.atan2(leftHip.y - rightHip.y, leftHip.x - rightHip.x) * (180 / Math.PI);

    if (Math.abs(pelvicAngle) > 3) {
        issues.push(pelvicAngle > 0 ? "骨盆侧倾" : "骨盆侧倾");
    }

    // 3. Round Shoulder (Side view - simplified)
    // Check if ear is forward relative to shoulder
    const ear = lm[7]; // Left ear (assuming side view shows left)
    const shoulder = lm[11];
    const neckForwardness = (ear.x - shoulder.x);

    if (neckForwardness > 0.1) {
        issues.push("圆肩/头前引");
    }

    // Calculate score (out of 100)
    let score = 100;
    score -= Math.abs(shoulderAngle) * 5;
    score -= Math.abs(pelvicAngle) * 5;
    if (neckForwardness > 0.05) score -= 20;

    score = Math.max(0, Math.min(100, score));

    return {
        shoulderAngle,
        pelvicAngle,
        roundShoulderIndex: neckForwardness,
        score: Math.round(score),
        issues
    };
};
