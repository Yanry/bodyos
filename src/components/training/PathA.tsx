import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, CheckCircle, Accessibility } from 'lucide-react';

interface Props {
    onComplete: () => void;
    onBack: () => void;
}

export const PathA: React.FC<Props> = ({ onComplete, onBack }) => {
    const [step, setStep] = useState<'instruction' | 'practice' | 'verify'>('instruction');

    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto" style={{ height: '100vh', background: 'var(--background)' }}>
            <AnimatePresence mode="wait">
                {step === 'instruction' && (
                    <motion.div
                        key="instruction"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col"
                    >
                        <div style={{ marginBottom: 32, marginTop: 20 }}>
                            <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', marginBottom: 16 }}>← 返回报告</button>
                            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>什么是骨盆中立位？</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>建立正确的身感，从感知中立开始</p>
                        </div>

                        <div className="premium-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
                            <div style={{ height: 200, background: '#1e293b', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <Accessibility size={80} color="var(--primary)" />
                                {/* Here we could put a real illustration or video */}
                            </div>
                            <div style={{ padding: 20 }}>
                                <h3 style={{ fontSize: 18, marginBottom: 12 }}>感官教学</h3>
                                <ul style={{ color: 'var(--text-secondary)', fontSize: 14, paddingLeft: 20, display: 'grid', gap: 12 }}>
                                    <li>想象你的骨盆是一个盛满水的碗</li>
                                    <li>前倾时，水会从碗的前方流出</li>
                                    <li>中立时，碗口保持水平，核心自然收紧</li>
                                </ul>
                            </div>
                        </div>

                        <button className="btn-primary" style={{ marginTop: 'auto', width: '100%' }} onClick={() => setStep('practice')}>
                            开始感知练习
                        </button>
                    </motion.div>
                )}

                {step === 'practice' && (
                    <motion.div
                        key="practice"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col"
                    >
                        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, marginTop: 20 }}>感知练习</h2>

                        <div style={{ flex: 1, display: 'grid', gap: 16 }}>
                            {[
                                { title: "前倾位感受", desc: "臀部向后撅，感受腰部肌肉的挤压感" },
                                { title: "后倾位感受", desc: "臀部向前卷，感受腹部底端的紧缩感" },
                                { title: "寻找中立位", desc: "在两者之间找到让腰椎最放松的一点" }
                            ].map((item, i) => (
                                <div key={i} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                                        {i + 1}
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 16, marginBottom: 2 }}>{item.title}</h4>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="premium-card" style={{ background: 'rgba(16, 185, 129, 0.1)', marginTop: 24 }}>
                            <p style={{ fontSize: 14, textAlign: 'center' }}>
                                <Info size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 记住这个“中立”的感觉，我们待会验证它
                            </p>
                        </div>

                        <button className="btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={() => setStep('verify')}>
                            进入动作验证
                        </button>
                    </motion.div>
                )}

                {step === 'verify' && (
                    <motion.div
                        key="verify"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col items-center justify-center text-center"
                    >
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                            <CheckCircle size={40} color="var(--secondary)" />
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>感知建立完成</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>
                            你已经了解了如何找回“中立位”。<br />下一步我们将通过单腿站立验证体态对稳定性的影响。
                        </p>
                        <button className="btn-primary" style={{ width: '100%' }} onClick={onComplete}>
                            开始：单腿站立测试
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
