# Global Spec Convention

**类型**: Global  
**版本**: v1.0  
**状态**: 进行中  
**最后更新**: 2026-02-05

---

## Changelog

### v1.0 - 2026-02-05
- ✅ 接收完整全局规范文档
- 定义相机模块全局规则(状态机、UI结构、交互规则)
- 定义功能文档模板结构
- 定义命名约定(模块ID、状态名、UI元素ID、数据键)
- 定义接口规范(Camera Input/Output, Analysis Input/Output)
- 定义冲突预防规则(z-index分层、状态隔离、数据隔离)
- 定义更新协议

---

## Implementation Log

### 理解要点

这是整个肌忆 MVP 项目的基础规范文档，定义了：

1. **相机模块共享规则**
   - 状态机: Idle → Preparing → Recording → Processing
   - UI 结构: Top Bar (返回/标题/帮助/设置) + 摄像头预览 + 底部控制栏
   - 交互规则: 首次进入说明、摄像头切换、倒计时、录制停止

2. **z-index 分层规范** (关键冲突预防)
   - 姿态模块: z-index 100-199
   - 动作模块: z-index 200-299
   - 共享 UI: z-index 300+

3. **命名约定**
   - 模块ID: `[domain]_[function]_[variant]` (如 `posture_camera_static`)
   - 状态名: `[module_id]_[state]` (如 `posture_camera_static_idle`)
   - UI元素ID: `[module_id]_[element]_[variant]`
   - 数据键: `snake_case`

4. **接口定义**
   - Camera Module Input: 包含 module_id, detection_type, mode 等
   - Camera Module Output: 包含 recording_data, keypoints_data
   - Analysis Module Output: 包含 score, issues, visualization

5. **模块隔离规则**
   - 独立状态机(使用 module_id 前缀)
   - 数据隔离(各模块写入 `[module_id]_session`)
   - 语音队列优先级管理

### 实现计划

由于这是全局规范而非具体功能，实现策略为：

1. **创建类型定义文件** (`src/types/global.ts`)
   - 定义所有接口 TypeScript 类型
   - 定义状态枚举
   - 定义常量 (z-index 范围等)

2. **创建相机模块基础组件** (`src/components/Camera/`)
   - CameraLayout (Top Bar + Preview + Control Bar)
   - CameraStateManager (状态机逻辑)
   - CameraControls (切换、录制按钮)

3. **创建工具函数** (`src/utils/`)
   - moduleId 生成器
   - 状态名称生成器
   - 数据验证函数

4. **文档化**
   - 在 `/docs` 中创建开发者指南引用此规范

### 依赖检查

- ✅ 项目已使用 TypeScript
- ✅ 已有 MediaPipe 相关依赖 (@mediapipe/pose)
- ⚠️ 需要确认相机权限处理库
- ⚠️ 需要确认语音播放库

### 待澄清问题

无 - 规范定义清晰完整

---

## 规格内容

# Purpose

Define unified standards for all Feature documents to prevent conflicts when feeding to Antigravity.

**Critical for**: Camera module (shared by Person A - Posture Detection & Person B - Motion Detection)

---

## 🎥 Camera Module Global Rules

### Shared Components

**Camera Page Structure**

```
[Top Bar]
- Left: Back button
- Center: Module title ("Posture Detection" / "Motion Detection")
- Right: Help "?" icon + Settings icon

[Main Area]
- Camera preview (full screen)
- Guidance overlay (defined per module)
- Control bar (bottom)

[Bottom Control Bar]
- Camera toggle button (front/back)
- Capture/Record button (center, large)
- Retake button (conditional)
```

### State Machine

| State | UI Elements | Transitions |
| --- | --- | --- |
| **Idle** | Camera preview + Guidance box | → Preparing (keypoints detected) |
| **Preparing** | Green box + Countdown | → Recording (countdown complete) |
| **Recording** | Red dot + Duration bar | → Processing (auto-stop or manual) |
| **Processing** | Loading spinner | → Result page |

### Unified Interaction Rules

**Entry**

- Always show "Shooting Instructions" modal on first entry (per module)
- Can be dismissed and accessed via "?" icon

**Camera Toggle**

- Icon position: Bottom-left
- Switch animation: Smooth flip (0.3s)
- Preserve guidance state after toggle

**Countdown**

- Trigger: Keypoints complete > 2 seconds
- Display: Center, large font (48pt)
- Voice: "3, 2, 1, Start" (if voice enabled)

**Recording Stop**

- Module-specific (defined in each Feature doc)
- Posture: Auto-capture (single frame)
- Motion: Auto-stop (time-based) or Manual (button)

---

## 📝 Feature Document Template

### Required Sections

```markdown
# [Module Name] Feature

## Module ID
- ID: [unique_module_id]
- Owner: [Person A/B]
- Dependencies: [list module IDs]

## Entry Point
- Trigger: [previous page + action]
- Example: "Action Selection → Click 'Wall Squat'"

## Page Structure
[Use Camera Module Global Rules as base]

### Module-specific Overlays
- Guidance elements unique to this module
- Z-index layer: [number]

## State Transitions
[Use Global State Machine + add module-specific states]

### Custom States
- State name
- UI changes
- Transition rules

## Data Flow
### Input
- From previous module: [data structure]

### Output
- To next module: [data structure]
- Format: JSON schema

## UI Elements Inventory
- Element name
- Position (x, y or named slot)
- Trigger condition
- Action

## Voice Prompts
- Timing: [when]
- Condition: [if]
- Script: [text]
- Priority: [1-3]

## Edge Cases
- Scenario
- Handling

## Exit Points
- Target page
- Condition
```

---

## 🏷️ Naming Conventions

### Module IDs

Format: `[domain]_[function]_[variant]`

Examples:

- `posture_camera_static`
- `motion_camera_wallsquat`
- `motion_camera_lunge`

### State Names

Format: `[module_id]_[state]`

Examples:

- `posture_camera_static_idle`
- `motion_camera_wallsquat_recording`

### UI Element IDs

Format: `[module_id]_[element]_[variant]`

Examples:

- `camera_toggle_button`
- `posture_guidance_box`
- `motion_countdown_label`

### Data Keys

Format: `snake_case`

Examples:

- `keypoints_data`
- `recording_duration`
- `detection_mode` ("evaluation" | "realtime")

---

## 🔗 Interface Definitions

### Camera Module Input

```json
{
  "module_id": "string",
  "detection_type": "posture" | "motion",
  "action_name": "string", // e.g., "wall_squat"
  "user_context": {
    "gender": "male" | "female",
    "baseline_score": number | null
  },
  "mode": "evaluation" | "realtime"
}
```

### Camera Module Output

```json
{
  "module_id": "string",
  "recording_data": {
    "video_frames": "blob" | "url",
    "duration": number, // seconds
    "camera_type": "front" | "back"
  },
  "keypoints_data": {
    "frame_rate": 30,
    "frames": [] // MediaPipe format
  },
  "timestamp": "ISO-8601"
}
```

### Analysis Module Input

(Receives Camera Module Output)

### Analysis Module Output

```json
{
  "module_id": "string",
  "score": number,
  "issues": [
    {
      "name": "string",
      "severity": "mild" | "moderate" | "severe",
      "value": "string",
      "weight": number,
      "deduction": number,
      "priority": number
    }
  ],
  "visualization": {
    "[body_part]": {
      "color": "green" | "yellow" | "red",
      "angle": number
    }
  },
  "mode": "evaluation" | "realtime"
}
```

---

## ⚠️ Conflict Prevention Rules

### When Both Modules Use Camera

1. **Separate State Machines**
    - Use module_id prefix for all states
    - No shared state variables
2. **Guidance Overlay Layers**
    - Posture module: z-index 100-199
    - Motion module: z-index 200-299
    - Shared UI: z-index 300+
3. **Voice Queue**
    - Single queue, priority-based
    - Module-specific prompts use module_id tag
    - System prompts (countdown) override module prompts
4. **Data Isolation**
    - Each module writes to `[module_id]_session` storage
    - No cross-module data access during session
    - Use Output → Input interface for handoff

### Cross-Module Dependencies

**If Module B depends on Module A's output**:

1. Document in Module B's "Dependencies" section
2. Define expected data structure in Module A's Output
3. Validate input in Module B's Entry Point

**Example**:

```markdown
## Dependencies
- Module: posture_report
- Required data: baseline_score, issues[]
- Fallback: If score unavailable, skip routing logic
```

---

## ✅ Pre-submission Checklist

Before feeding document to Anti:

- [ ]  Module ID is unique and follows naming convention
- [ ]  All states use module_id prefix
- [ ]  Data Input/Output schemas are defined
- [ ]  Voice prompts have priority assigned
- [ ]  UI elements don't overlap with other modules
- [ ]  Edge cases include camera permission denial
- [ ]  Exit points are clearly defined
- [ ]  Dependencies are documented

---

## 🔄 Update Protocol

When updating shared Camera rules:

1. Update this Global Spec first
2. Notify all owners using Camera module
3. Update affected Feature docs
4. Increment version in commit message: `[Camera v1.1]`

---

[返回主文档](../../README.md) | [查看实现跟踪](../../implementation-tracking.md)
