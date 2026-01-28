import React from 'react';
import type { PostureMetrics } from '../../utils/postureAnalysis';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, ArrowRight, Activity, RefreshCw } from 'lucide-react';

interface Props {
    metrics: PostureMetrics;
    onContinue: (path: 'A' | 'B') => void;
    onRetake: () => void;
}

export const PostureReport: React.FC<Props> = ({ metrics, onContinue, onRetake }) => {
    const isPoor = metrics.score < 70;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col p-6 overflow-y-auto"
            style={{ height: '100vh', background: 'var(--background)' }}
        >
            <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 20 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>体态检测报告</h2>
                <p style={{ color: 'var(--text-secondary)' }}>基于 AI 骨骼点识别分析</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
                <div style={{
                    width: 160, height: 160, borderRadius: '50%',
                    border: '8px solid var(--border)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    position: 'relative',
                    background: `conic-gradient(var(--primary) ${metrics.score}%, transparent 0)`
                }}>
                    <div style={{
                        position: 'absolute', inset: 8, background: 'var(--background)', borderRadius: '50%',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 48, fontWeight: 800 }}>{metrics.score}</span>
                        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>综合评分</span>
                    </div>
                </div>
            </div>

            <div className="premium-card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={20} color="var(--primary)" /> 检测项
                </h3>
                <div style={{ display: 'grid', gap: 12 }}>
                    {metrics.issues.length > 0 ? (
                        metrics.issues.map((issue, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 12 }}>
                                <AlertTriangle size={18} color="var(--accent)" />
                                <span style={{ fontSize: 15 }}>{issue}</span>
                            </div>
                        ))
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 12 }}>
                            <CheckCircle2 size={18} color="var(--secondary)" />
                            <span style={{ fontSize: 15 }}>体态良好，继续保持</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="premium-card" style={{ background: isPoor ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: 'none' }}>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>训练建议</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    {isPoor
                        ? "检测到明显的体态失衡，建议先通过「感认知训练」建立正确的身体中立位感觉。"
                        : "你的体态基础不错，可以直接进入「动作精准度检测」，优化发力模式。"}
                </p>
                <button
                    className="btn-primary"
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                    onClick={() => onContinue(isPoor ? 'A' : 'B')}
                >
                    {isPoor ? "进入：体态感知训练" : "进入：动作检测"} <ArrowRight size={18} />
                </button>
            </div>

            <button
                onClick={onRetake}
                style={{ marginTop: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
                <RefreshCw size={16} /> 重新检测
            </button>
        </motion.div>
    );
};
