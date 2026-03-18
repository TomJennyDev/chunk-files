# 🐳 Docker & Docker Compose — Deep Dive Learning Path

Tài liệu học chuyên sâu từ góc nhìn **Senior DevOps Engineer**. Không chỉ dừng ở "cách chạy container" mà đi sâu vào **Linux kernel internals, networking stack, storage drivers, security hardening, và production patterns**.

## 🧭 Learning Roadmap

### Phase 1: Container Internals (Hiểu bản chất)
Trước khi dùng Docker, phải hiểu container thật sự là gì ở mức OS kernel.
- 📄 [Container Fundamentals](./CONTAINER-FUNDAMENTALS.md) — Linux Namespaces, Cgroups, Union Filesystem, OCI Runtime Spec
- 📄 [Cgroups & Namespaces Deep Dive](./CGROUPS-AND-NAMESPACES.md) — Kernel syscalls, PID/NET/USER NS chi tiết, Cgroups v2, PSI, OOM, CPU throttling, Hands-on Labs
- 📄 [Image Architecture](./IMAGE-ARCHITECTURE.md) — Image Layers, Content-Addressable Storage, Registry, Manifest Lists, Multi-arch

### Phase 2: Build Mastery (Build image như senior)
- 📄 [Dockerfile Best Practices](./DOCKERFILE-BEST-PRACTICES.md) — Multi-stage Builds, Layer Optimization, BuildKit, Cache Mount, Security Scanning
- 📄 [CI/CD with Docker](./CI-CD-DOCKER.md) — GitHub Actions, Layer Caching in CI, DIND vs DooD, Kaniko, Build Matrix

### Phase 3: Runtime Deep Dive (Networking + Storage + Security)
- 📄 [Networking Deep Dive](./NETWORKING-DEEP-DIVE.md) — Bridge, Host, Overlay, Macvlan, DNS Resolution, iptables, Service Discovery
- 📄 [Storage & Volumes](./STORAGE-AND-VOLUMES.md) — Storage Drivers, Bind Mounts, Named Volumes, tmpfs, Backup Strategies
- 📄 [Security Hardening](./SECURITY-HARDENING.md) — Rootless Mode, Seccomp, AppArmor, Capabilities, Image Signing, Trivy/Grype

### Phase 4: Docker Compose (Multi-container Orchestration)
- 📄 [Compose Fundamentals](./COMPOSE-FUNDAMENTALS.md) — Services, Networks, Volumes, Environment, YAML Anchors, Compose File Spec
- 📄 [Compose Advanced Patterns](./COMPOSE-ADVANCED-PATTERNS.md) — Profiles, Extends, Health Checks, Secrets, Init Containers, Watch Mode
- 📄 [Compose Networking](./COMPOSE-NETWORKING.md) — Service Discovery, Custom Networks, External Networks, DNS, Load Balancing
- 📄 [Compose for Production](./COMPOSE-PRODUCTION.md) — Deploy Configs, Resource Limits, Rolling Updates, Blue/Green, Swarm Mode

### Phase 5: Operations & Troubleshooting
- 📄 [Performance Optimization](./PERFORMANCE-OPTIMIZATION.md) — Resource Limits, Cgroup v2, Monitoring, Container Profiling, Slim Images
- 📄 [Troubleshooting Guide](./TROUBLESHOOTING.md) — Debug Techniques, Logging Drivers, nsenter, docker exec, Common Issues

---

## 📊 Reading Time Estimate

| Document | Reading Time | Difficulty |
|----------|-------------|------------|
| Container Fundamentals | ~25 min | ⭐⭐⭐⭐⭐ |
| Cgroups & Namespaces Deep Dive | ~35 min | ⭐⭐⭐⭐⭐ |
| Image Architecture | ~20 min | ⭐⭐⭐⭐ |
| Dockerfile Best Practices | ~25 min | ⭐⭐⭐⭐ |
| Networking Deep Dive | ~30 min | ⭐⭐⭐⭐⭐ |
| Storage & Volumes | ~20 min | ⭐⭐⭐ |
| Security Hardening | ~25 min | ⭐⭐⭐⭐⭐ |
| Performance Optimization | ~20 min | ⭐⭐⭐⭐ |
| Compose Fundamentals | ~20 min | ⭐⭐⭐ |
| Compose Advanced Patterns | ~25 min | ⭐⭐⭐⭐ |
| Compose Networking | ~20 min | ⭐⭐⭐⭐ |
| Compose for Production | ~25 min | ⭐⭐⭐⭐⭐ |
| CI/CD with Docker | ~25 min | ⭐⭐⭐⭐ |
| Troubleshooting | ~20 min | ⭐⭐⭐ |

**Total: ~5.5 hours** for complete deep dive.

---

## 🎯 Target Audience

| Level | What you'll gain |
|-------|-----------------|
| **Mid-level Dev** | Understand WHY containers work, not just HOW to run them |
| **Senior Dev** | Production patterns, security, performance tuning |
| **DevOps Engineer** | CI/CD integration, multi-stage builds, troubleshooting |
| **Senior DevOps / SRE** | Kernel internals, custom networks, runtime security, capacity planning |

---

## 🔗 Related Docs
- [Observability](../observability/README.md) — Monitor containers with OpenTelemetry, Grafana, Loki
- [Senior Architect](../senior-architect/README.md) — System design, microservices patterns
- [Infrastructure](../modules/INFRASTRUCTURE.md) — LocalStack + Terraform setup
