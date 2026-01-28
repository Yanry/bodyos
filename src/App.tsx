import { useState, useEffect } from 'react'
import './index.css'
import { Activity, Camera, TrendingUp, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { PostureDetection } from './components/posture/PostureDetection'
import { PostureReport } from './components/posture/PostureReport'
import { PathA } from './components/training/PathA'
import { PathB } from './components/training/PathB'
import type { PostureMetrics } from './utils/postureAnalysis'

function App() {
  const [stage, setStage] = useState<'welcome' | 'detecting' | 'report' | 'pathA' | 'pathB' | 'discomfort'>(() => {
    return (localStorage.getItem('jiyi-stage') as any) || 'welcome'
  })
  const [metrics, setMetrics] = useState<PostureMetrics | null>(() => {
    const saved = localStorage.getItem('jiyi-metrics')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    localStorage.setItem('jiyi-stage', stage)
  }, [stage])

  useEffect(() => {
    if (metrics) localStorage.setItem('jiyi-metrics', JSON.stringify(metrics))
  }, [metrics])

  const handlePostureComplete = (m: PostureMetrics) => {
    setMetrics(m)
    setStage('report')
  }

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {stage === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col p-6 text-center"
            style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, type: 'spring' }}
                style={{
                  width: 80, height: 80,
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  borderRadius: 20, display: 'flex', justifyContent: 'center', alignItems: 'center',
                  marginBottom: 24, boxShadow: '0 8px 16px rgba(59, 130, 246, 0.4)'
                }}
              >
                <Activity size={40} color="white" />
              </motion.div>

              <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}>
                肌 <span className="gradient-text">忆</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 18, maxWidth: '80%', margin: '0 auto 40px' }}>
                体态纠正与运动损伤预防，建立你的具身认知
              </p>

              <div style={{ width: '100%', display: 'grid', gap: 16 }}>
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className="premium-card"
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                  onClick={() => setStage('detecting')}
                >
                  <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: 10, borderRadius: 12 }}>
                    <Camera size={24} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>体态检测</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>识别高低肩、圆肩、骨盆前倾</p>
                  </div>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className="premium-card"
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                  onClick={() => setStage('pathB')}
                >
                  <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 10, borderRadius: 12 }}>
                    <TrendingUp size={24} color="var(--secondary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>发力引导</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>实时反馈肌肉代偿，优化运动表现</p>
                  </div>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className="premium-card"
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                  onClick={() => setStage('discomfort')}
                >
                  <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: 10, borderRadius: 12 }}>
                    <AlertCircle size={24} color="var(--accent)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>不适建议</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>关联训练动作，降低损伤风险</p>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="safe-area-bottom" style={{ padding: '24px 0' }}>
              <button
                className="btn-primary"
                style={{ width: '100%' }}
                onClick={() => setStage('detecting')}
              >
                开始体态检测
              </button>
            </div>
          </motion.div>
        )}

        {stage === 'detecting' && (
          <PostureDetection
            key="detecting"
            onComplete={handlePostureComplete}
            onBack={() => setStage('welcome')}
          />
        )}

        {stage === 'report' && metrics && (
          <PostureReport
            key="report"
            metrics={metrics}
            onContinue={(p) => setStage(p === 'A' ? 'pathA' : 'pathB')}
            onRetake={() => setStage('detecting')}
          />
        )}

        {stage === 'pathA' && (
          <PathA
            key="pathA"
            onComplete={() => setStage('welcome')}
            onBack={() => setStage('report')}
          />
        )}

        {stage === 'pathB' && (
          <PathB
            key="pathB"
            onComplete={() => setStage('welcome')}
            onBack={() => setStage('welcome')}
          />
        )}

        {stage === 'discomfort' && (
          <motion.div
            key="discomfort"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col p-6"
            style={{ height: '100vh', background: 'var(--background)' }}
          >
            <div style={{ marginBottom: 32, marginTop: 20 }}>
              <button onClick={() => setStage('welcome')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', marginBottom: 16 }}>← 返回首页</button>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>记录你的不适</h2>
              <p style={{ color: 'var(--text-secondary)' }}>点击身体部位或选择部位记录痛点</p>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="premium-card" style={{ width: '100%', textAlign: 'center' }}>
                <AlertCircle size={48} color="var(--accent)" style={{ margin: '0 auto 16px' }} />
                <p>不适记录模块正在建设中...</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>我们将关联你最近的深蹲数据进行分析</p>
              </div>
            </div>

            <button className="btn-primary" style={{ width: '100%', marginTop: 24 }} onClick={() => setStage('welcome')}>
              完成记录
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
