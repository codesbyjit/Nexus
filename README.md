# Nexus
A polyglot microservices-based streaming platform

# ::
```
Nexus/
│
├── apps/                       # All runnable services
│   ├── web/                    # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── next.config.js
│   │
│   ├── api-gateway/            # NestJS – entry point for clients
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── content/
│   │   │   │   └── users/
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   └── Dockerfile
│   │
│   ├── auth-service/           # NestJS – authentication
│   │   ├── src/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   └── Dockerfile
│   │
│   ├── content-service/        # NestJS – movies, watch history
│   │   ├── src/
│   │   │   ├── content.controller.ts
│   │   │   ├── content.service.ts
│   │   │   └── content.module.ts
│   │   └── Dockerfile
│   │
│   ├── recs-service/           # Python – recommendations
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py
│   │   │   └── recommender.py
│   │   └── Dockerfile
│   │
│   └── worker/                 # Go – FFmpeg + background jobs
│       ├── cmd/
│       │   └── worker/
│       │       └── main.go
│       ├── internal/
│       │   ├── ffmpeg/
│       │   ├── jobs/
│       │   └── storage/
│       └── Dockerfile
│
├── packages/                   # Shared logic (VERY important)
│   ├── db/                     # Prisma schema + migrations
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── storage/                # S3-compatible abstraction
│   │   ├── index.ts
│   │   └── s3.client.ts
│   │
│   ├── shared/                 # Shared types & utils
│   │   ├── types/
│   │   └── constants.ts
│   │
│   └── config/                 # Env & config helpers
│       └── index.ts
│
├── docker/                     # Local infra
│   ├── postgres/
│   ├── redis/
│   └── minio/
│
├── docker-compose.yml          # Local orchestration
├── .env.example
├── turbo.json / nx.json        #(optional) (X)
├── package.json
└── README.md
```