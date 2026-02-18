# 🔗 Companion–Model Mapping Table

**Owner:** Aubert

> “No companion floats. Every one is grounded in the right model.”

---

### 🎯 Purpose

This document defines the mapping between CareAI’s registered companions and the specific AI models that power their behavior, tone regulation, and memory interaction.

It ensures that:
- Each companion has a justified, governed model assignment
- LLM behavior aligns with companion tone, empathy profile, and fallback protocols
- Deployment routing remains auditable and simulation-validated

---

### 📊 Mapping Table

| Companion Name | Primary Model | Memory Scope | Gamification | Swap-Ready Models | Fallback Path |
| --- | --- | --- | --- | --- | --- |
| **Memora** | Memora AI | Session + User | ❌ None | Minimal Mode, Sleep Assistant | Companion Silence Protocol |
| **Reflection Coach** | Memora AI | Session only | ❌ None | Memora, Minimal Mode | Tone-Calibrated Refusal |
| **SmartHabits** | Memora AI | Session + Ambient | ✅ Partial | Minimal Mode | Prompt Deactivation |
| **MyLearning Companion** | MyLearning AI | Session (Guardian-opt) | ✅ Full | Minimal Mode (Youth) | Visual-only fallback |
| **PuzzleBot** | MyLearning AI | Session only | ✅ Partial | Sleep Assistant (Youth) | Game loop suspension |
| **Sleep Ritual Assistant** | Memora AI | Session only | ❌ None | Minimal Mode | Prompt silence + screen dim |
| **NeuroBridge Companion** | NeuroBridge Engine | Ambient + Session | ❌ None | Staff Intervention Mode | Human summary + log export |
| **Minimal Mode** | No Model | No memory | ❌ None | All models | No fallback (terminal mode) |

---

### 🔍 Governance Notes

- Every model-companion pair must pass tone simulation and memory safety review
- No companion may use a model with broader memory access than its assigned consent profile
- Fallbacks are tested during Simulation Suite and Behavior Escalation protocols
