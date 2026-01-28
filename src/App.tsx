import { useState } from 'react'
import './index.css'
import { Activity, Camera, TrendingUp, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { PostureDetection } from './components/posture/PostureDetection'
import { PostureReport } from './components/posture/PostureReport'
import { PathA } from './components/training/PathA'
import { PathB } from './components/training/PathB'
import type { PostureMetrics } from './utils/postureAnalysis'

function App() {
  const [stage, setStage] = useState<'welcome' | 'detecting' | 'report' | 'pathA' | 'pathB'>('welcome')
  const [metrics, setMetrics] = useState<PostureMetrics | null>(null)

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
                <div className="premium-card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: 10, borderRadius: 12 }}>
                    <Camera size={24} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>体态检测</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>识别高低肩、圆肩、骨盆前倾</p>
                  </div>
                </div>

                <div className="premium-card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 10, borderRadius: 12 }}>
                    <TrendingUp size={24} color="var(--secondary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>发力引导</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>实时反馈肌肉代偿，优化运动表现</p>
                  </div>
                </div>

                <div className="premium-card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: 10, borderRadius: 12 }}>
                    <AlertCircle size={24} color="var(--accent)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>不适建议</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>关联训练动作，降低损伤风险</p>
                  </div>
                </div>
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
            onBack={() => setStage('report')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
