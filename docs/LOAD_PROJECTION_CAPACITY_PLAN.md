# Nzila OS — Load Projection & Capacity Planning

**Date**: 2026-04-14  
**Status**: Ready for execution  
**Target**: Validate system capacity for 100K concurrent users before Africa launch  

---

## Executive Summary

This document outlines the load testing strategy, expected resource requirements, and scaling triggers for Nzila OS. The goal is to establish evidence that the platform can handle 10x → 100x baseline load with acceptable latency and error rates.

**Key Metrics**:
- **Baseline**: 100 concurrent users, <500ms p95 latency
- **10K Scale**: 10,000 concurrent users, <2s p95 latency
- **100K Scale**: 100,000 concurrent users (Africa launch readiness), <2s p95 latency

---

## Load Test Matrix

### Smoke Test (1 VU, 1 min)
- **Purpose**: Sanity check; validates test infrastructure
- **Runs**: Pre-deployment CI on every PR
- **Resources**: Minimal (~10m CPU, ~50MB memory)
- **Key Thresholds**: None (informational only)

### Baseline (100 VUs, 5 min)
- **Purpose**: Normal operating load; establishes baseline performance
- **Concurrency**: ~100 concurrent users
- **Ramp-up**: 1 minute
- **Expected Resource Usage Per Node**:
  - CPU: ~250 millicores
  - Memory: ~150 MB
  - Database connections: ~5–10 (pool size 20)
- **Latency Targets**:
  - Health check: p95 <200ms, p99 <500ms
  - Search/list ops: p95 <500ms, p99 <2s
  - Mutations: p95 <1.5s, p99 <5s
- **Error Rate**: <0.5%

### Scale 1K (1,000 VUs, 10 min)
- **Purpose**: 10x baseline; validates linear scaling
- **Concurrency**: ~1,000 concurrent users
- **Ramp-up**: 2 minutes
- **Expected Resource Usage Per Node**:
  - CPU: ~2.5 CPU cores
  - Memory: ~1.5 GB
  - Database connections: ~50 (pool exhaustion risk begins here)
- **Latency Targets**: Same as baseline (aim for steady latency, not linear growth)
- **Error Rate**: <1%
- **Monitoring Focus**: Database connection pool saturation, disk I/O

### Scale 10K (10,000 VUs, 15 min)
- **Purpose**: 100x baseline; validates system throughput ceiling
- **Concurrency**: ~10,000 concurrent users
- **Ramp-up**: 3 minutes
- **Expected Resource Usage Per Node**:
  - CPU: ~4 CPU cores
  - Memory: ~4 GB
  - Database connections: ~200 (pool critical; cluster scaling needed)
  - Disk IOPS: ~1,000–2,000
- **Latency Targets**: p95 <2s (acceptable for large-scale load)
- **Error Rate**: <1%
- **Scaling Trigger**: If p95 latency >2s, increase horizontal replicas

### Scale 100K (50,000 VUs, 20 min)
- **Purpose**: Stress test for Africa launch; validates architectural limits
- **Concurrency**: ~100,000 concurrent users
- **Ramp-up**: 5 minutes
- **Expected Resource Usage Per Cluster**:
  - Containers: 5–8 replicas (2–4 CPU + 2–4 GB memory each)
  - PostgreSQL: 8+ CPU cores, 16+ GB memory, connection pool ≥500
  - Redis: ~2 GB memory
  - Load balancer: Auto-scaled
- **Latency Targets**: p95 <3s (degradation acceptable at extreme load)
- **Error Rate**: <2%
- **Expected Blockers**: Database query optimizer, connection pooling, Redis eviction

---

## Apps Under Test

### Zonga (Media Platform)
- **Workload**: 60% static content retrieval, 30% playback URL generation, 10% live stream metadata
- **Key Metrics**: Media catalog latency, playback URL signing latency, live stream latency
- **Load Test**: [tests/load/zonga.js](tests/load/zonga.js)

### Union Eyes (Case Management)
- **Workload**: 60% case/member search, 30% case creation, 10% bulk member import
- **Key Metrics**: Search latency, case creation latency, import throughput
- **Load Test**: [tests/load/union-eyes.js](tests/load/union-eyes.js)

### Agrimo (Cooperative Management)
- **Workload**: 50% farmer profile reads, 30% harvest data ingestion, 20% member profile updates
- **Key Metrics**: Profile latency, ingestion throughput, update latency
- **Load Test**: [tests/load/agrimo.js](tests/load/agrimo.js)

---

## SLO Definitions

### Health Check Endpoints
- **p95 Latency**: <200ms
- **p99 Latency**: <500ms
- **Error Rate**: <0.1%
- **Purpose**: Quick availability checks; must be extremely fast

### Read-Heavy Endpoints (Search, List, Get)
- **p95 Latency**: <500ms
- **p99 Latency**: <2s
- **Error Rate**: <0.5%
- **Examples**: `/api/cases/search`, `/api/farmers/{id}`, `/api/media?q=...`

### Mutation Endpoints (Create, Update, Delete)
- **p95 Latency**: <1.5s
- **p99 Latency**: <5s
- **Error Rate**: <1%
- **Examples**: `/api/cases` (POST), `/api/farmers/{id}` (PATCH)

### Data Ingestion Endpoints (Bulk Import, Streaming)
- **p95 Latency**: <2s per item (batched)
- **p99 Latency**: <10s per batch
- **Error Rate**: <2%
- **Throughput Target**: >10K items/sec
- **Examples**: `/api/members/import`, `/api/harvests` (bulk)

---

## Capacity Scaling Playbook

### Trigger 1: CPU Utilization >75%
**Action**: Increase container replicas by 1 (e.g., 3 → 4 replicas)  
**Timeline**: 2 minutes  
**Evidence**: CloudWatch Memory + CPU metrics in Azure Container Apps

### Trigger 2: Database Connection Pool >85% Utilization
**Action**: Increase PgBouncer connection pool (or migrate to larger PostgreSQL instance)  
**Timeline**: 5 minutes (requires restart)  
**Evidence**: PgBouncer metrics + application logs

### Trigger 3: Redis Memory >90%
**Action**: Enable eviction policy OR upgrade to larger Redis instance  
**Timeline**: 1 minute (eviction is automatic if policy set)  
**Evidence**: Redis INFO command memory metrics

### Trigger 4: Disk I/O Utilization >80%
**Action**: Enable SSD upgrade or migrate to larger storage class  
**Timeline**: Rolling restart (30 min)  
**Evidence**: Azure Storage Account metrics

### Trigger 5: p95 Latency >2s at Baseline Load
**Action**: Investigate query performance (log slow queries, add indexes)  
**Timeline**: Hotfix required  
**Evidence**: Application Performance Insights (APM) traces

---

## Execution Plan

### Phase 1: Validation (Week 1)
- [ ] Run smoke test on all three apps (validate test harness)
- [ ] Run baseline load test; establish baseline latency profile
- [ ] Document baseline resource usage

### Phase 2: Scaling (Week 2)
- [ ] Run 1K load test; verify linear scaling
- [ ] Identify any early bottlenecks (DB connection pool, Redis, etc.)
- [ ] Document scaling behavior

### Phase 3: Stress Test (Week 3)
- [ ] Run 10K load test; measure p95/p99 latencies
- [ ] Run 100K load test (or as far as infrastructure allows)
- [ ] Generate final capacity report

### Phase 4: Runbook & Documentation (Week 4)
- [ ] Create on-call runbook (scale triggers, remediation steps)
- [ ] Update deployment docs with capacity thresholds
- [ ] Brief DevOps and on-call teams

---

## Expected Results & Acceptance Criteria

**Pass Criteria** (all must be met for launch readiness):

1. ✅ Baseline (100 VUs): p95 latency <500ms, error rate <0.5%
2. ✅ 1K Load (1,000 VUs): p95 latency <500ms (no degradation), error rate <1%
3. ✅ 10K Load (10,000 VUs): p95 latency <2s, error rate <1%
4. ✅ 100K Load (50,000 VUs): p95 latency <3s, error rate <2%
5. ✅ All three apps (Zonga, UE, Agrimo) tested with realistic workload mixes
6. ✅ Resource projections documented (CPU, memory, storage, DB connections per load tier)
7. ✅ Scaling playbook signed off by DevOps team

**Failure Criteria** (any one triggers investigation):

- p95 latency >2s at 10K VUs (architectural issue)
- Error rate >2% at any scale (reliability risk)
- Database or Redis becomes a single point of failure
- Cannot scale horizontally (suggests monolithic bottleneck)

---

## Tools & Infrastructure

### Load Testing Framework
- **Tool**: k6 (JavaScript; lightweight; cloud-ready)
- **Scripts**: `tests/load/*.js` (config-driven via environment variables)
- **Execution**: Manual (`k6 run`) + CI integration (GitHub Actions)

### Monitoring During Tests
- **Metrics**: Azure Monitor, Application Insights
- **Logs**: App logs (stdout), database slow-query logs
- **Traces**: Optional APM integration (e.g., via OpenTelemetry)

### Targets
- Staging environment (`staging.nzila.dev` or similar)
- Must have realistic database size (or representative subset)
- Network conditions: realistic latency (~50ms to cloud from typical location)

---

## References

- [k6 Documentation](https://k6.io/docs)
- [SLO Best Practices](https://sre.google/workbook/slo-document-template/)
- [Capacity Planning Guide](https://www.redhat.com/en/topics/capacity-planning)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Capacity Planning](https://redis.io/topics/memory-optimization)

---

## Appendix: Real-World Scaling Examples

### Scenario A: Normal Day (1K Concurrent Users)
- **Resource Usage**: 1–2 container replicas, 1 PostgreSQL instance (standard tier)
- **Cost**: ~$100–150/day
- **Latency**: p95 <500ms, p99 <1s

### Scenario B: High Traffic Day (10K Concurrent Users)
- **Resource Usage**: 4–5 container replicas, 1 PostgreSQL + read replicas, 1 Redis
- **Cost**: ~$500–750/day
- **Latency**: p95 <2s, p99 <5s

### Scenario C: Africa Launch Spike (100K Concurrent Users Over 8 Hours)
- **Resource Usage**: 8–10 container replicas, PostgreSQL cluster, Redis cluster
- **Cost**: ~$2,000–3,000 for launch day peak
- **Latency**: p95 <3s, p99 <10s
- **Mitigation**: Pre-warm cache, enable read-only mode for non-critical features if needed

---

**Next Steps**: Execute Phase 1 validation, then brief leadership on capacity findings before Africa launch commitment.
