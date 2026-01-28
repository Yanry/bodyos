import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Activity } from 'lucide-react';

interface Props {
    onComplete: () => void;
    onBack: () => void;
}

export const PathB: React.FC<Props> = ({ onComplete, onBack }) => {
    const [step, setStep] = useState<'intro' | 'analyze' | 'result'>('intro');

    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto" style={{ height: '100vh', background: 'var(--background)' }}>
            <AnimatePresence mode="wait">
                {step === 'intro' && (
                    <motion.div
                        key="intro"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col"
                    >
                        <div style={{ marginBottom: 32, marginTop: 20 }}>
                            <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', marginBottom: 16 }}>← 返回报告</button>
                            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>动作检测：深蹲</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>你的发力分布是否平衡？</p>
                        </div>

                        <div className="premium-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
                            <div style={{ height: 200, background: '#1e293b', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                                <Target size={80} color="var(--secondary)" />
                                <div style={{ position: 'absolute', inset: 0, border: '1px solid var(--secondary)', opacity: 0.2, margin: 20, borderRadius: 12 }}></div>
                            </div>
                            <div style={{ padding: 20 }}>
                                <h3 style={{ fontSize: 18, marginBottom: 12 }}>检测重点</h3>
                                <ul style={{ color: 'var(--text-secondary)', fontSize: 14, paddingLeft: 20, display: 'grid', gap: 12 }}>
                                    <li>膝盖是否内扣（ACL损伤风险）</li>
                                    <li>重心是否过度前移</li>
                                    <li>臀大肌唤醒程度</li>
                                </ul>
                            </div>
                        </div>

                        <button className="btn-primary" style={{ marginTop: 'auto', width: '100%' }} onClick={() => setStep('analyze')}>
                            开始实时检测
                        </button>
                    </motion.div>
                )}

                {step === 'analyze' && (
                    <motion.div
                        key="analyze"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col items-center justify-center"
                    >
                        {/* Mocking the detection process */}
                        <Activity size={64} className="gradient-text" style={{ marginBottom: 24 }} />
                        <h3 style={{ fontSize: 18, marginBottom: 8 }}>正等待姿态同步...</h3>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '70%', textAlign: 'center' }}>请侧对摄像头，完成 3 次深蹲</p>

                        <motion.div
                            style={{ width: '80%', height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 40, overflow: 'hidden' }}
                        >
                            <motion.div
                                animate={{ width: ['0%', '100%'] }}
                                transition={{ duration: 5 }}
                                onAnimationComplete={() => setStep('result')}
                                style={{ height: '100%', background: 'var(--primary)' }}
                            />
                        </motion.div>
                    </motion.div>
                )}

                {step === 'result' && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex flex-col"
                    >
                        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, marginTop: 20, textAlign: 'center' }}>检测结果</h2>

                        <div className="premium-card" style={{ marginBottom: 24 }}>
                            <h3 style={{ fontSize: 16, marginBottom: 16 }}>发力分布 (Estimated)</h3>
                            <div style={{ display: 'grid', gap: 16 }}>
                                {[
                                    { label: "股四头肌 (腿前)", value: 70, color: 'var(--primary)' },
                                    { label: "臀大肌 (屁股)", value: 30, color: 'var(--secondary)' }
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                                            <span>{item.label}</span>
                                            <span style={{ fontWeight: 700 }}>{item.value}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4 }}>
                                            <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 4 }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="premium-card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: 'none' }}>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                提示：由于膝盖轻微内扣，你的负重主要由膝关节和腿前侧承担。建议「臀部收紧像夹橘子」，膝盖向外推。
                            </p>
                        </div>

                        <button className="btn-primary" style={{ marginTop: 'auto', width: '100%' }} onClick={onComplete}>
                            按引导重做一次
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
