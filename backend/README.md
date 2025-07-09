# Notes API - Real-Time Collaborative Notes Backend

A scalable, containerized backend for a real-time collaborative notes application built with .NET 9, designed for Docker deployment with cloud migration readiness.

## 🚀 Features

- **Real-time Collaboration**: SignalR-powered live synchronization
- **Email-based Authentication**: JWT token-based auth system
- **Viewport Optimization**: Load only visible notes for performance
- **Optimistic Concurrency**: Conflict resolution with version control
- **Multi-level Caching**: In-memory caching for performance
- **Docker-First**: Containerized with Docker Compose orchestration
- **Cloud-Ready**: Azure/AWS migration ready
- **Comprehensive Logging**: Structured logging with Serilog
- **Health Monitoring**: Built-in health checks
- **XSS Protection**: HTML sanitization for security

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Controllers   │    │    Services     │    │   Repositories  │
│                 │    │                 │    │                 │
│  • AuthController│───▶│  • AuthService  │───▶│  • Repository<T>│
│  • NotesController│   │  • NoteService  │    │                 │
│  • UsersController│   │  • UserService  │    │                 │
│  • HealthController│  │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SignalR Hub   │    │   Caching       │    │   Database      │
│                 │    │                 │    │                 │
│ • CollaborationHub│  │ • IMemoryCache  │    │ • SQL Server    │
│ • Real-time sync│    │ • Multi-level   │    │   (All Envs)    │
│ • User presence │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Notes Management
- `GET /api/workspaces/{workspaceId}/notes` - Get notes (with viewport filtering)
- `POST /api/workspaces/{workspaceId}/notes` - Create note
- `PUT /api/notes/{id}` - Update note
- `DELETE /api/notes/{id}` - Delete note
- `PATCH /api/notes/{id}/position` - Move note

### User Management
- `GET /api/users/online` - Get online users
- `PUT /api/users/presence` - Update presence

### Health Checks
- `GET /health` - Application health
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

## 🔄 SignalR Real-time Events

### Client → Server
- `JoinWorkspace(workspaceId)` - Join workspace
- `LeaveWorkspace(workspaceId)` - Leave workspace
- `UpdateCursor(workspaceId, x, y)` - Update cursor position
- `CreateNote(workspaceId, noteData)` - Create note
- `UpdateNote(noteId, noteData)` - Update note
- `MoveNote(noteId, x, y)` - Move note
- `DeleteNote(noteId)` - Delete note

### Server → Client
- `UserJoined(email)` - User joined workspace
- `UserLeft(email)` - User left workspace
- `CursorMoved(email, x, y)` - User moved cursor
- `NoteCreated(noteData)` - Note created
- `NoteUpdated(noteData)` - Note updated
- `NoteMoved(noteData)` - Note moved
- `NoteDeleted(noteId)` - Note deleted
- `Error(message)` - Error occurred

## 🛠️ Technology Stack

- **.NET 9** - Application framework
- **ASP.NET Core** - Web framework
- **Entity Framework Core** - ORM
- **SignalR** - Real-time communication
- **SQL Server** - Database (all environments)
- **JWT** - Authentication
- **Serilog** - Structured logging
- **Docker** - Containerization
- **HtmlSanitizer** - XSS protection

## 🚀 Quick Start

### Prerequisites
- .NET 9 SDK
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd collaborative_notes/backend
```

2. **Run with Docker Compose (Recommended)**
```bash
# Development mode with hot reload
docker-compose -f docker-compose.dev.yml up -d

# Production mode
docker-compose -f docker-compose.prod.yml up -d
```

3. **Run locally**
```bash
# Restore packages
dotnet restore

# Run the application
dotnet run

# Or with hot reload
dotnet watch run
```

4. **Access the API**
- Swagger UI: http://localhost:5000
- Health Check: http://localhost:5000/health
- SignalR Hub: ws://localhost:5000/hubs/collaboration

## 📝 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ASPNETCORE_ENVIRONMENT` | Environment | Development |
| `ConnectionStrings__DefaultConnection` | Database connection | SQLite for dev |
| `JWT__SecretKey` | JWT signing key | **Required** |
| `JWT__Issuer` | JWT issuer | NotesApp |
| `JWT__Audience` | JWT audience | NotesApp |
| `JWT__ExpiryHours` | Token expiry | 24 |
| `Cors__AllowedOrigins__0` | CORS origin | http://localhost:3000 |

### Database Configuration

**Development**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=NotesAppDev;User Id=sa;Password=YourPassword123!;TrustServerCertificate=true;"
  }
}
```

**Production**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=sqlserver;Database=NotesApp;User Id=sa;Password=YourPassword123!;TrustServerCertificate=true;"
  }
}
```

## 🐳 Docker Deployment

### Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop
docker-compose -f docker-compose.dev.yml down
```

### Production
```bash
# Set environment variables
export JWT_SECRET="your-super-secret-jwt-key"
export SQL_PASSWORD="YourSecurePassword123!"

# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# Health check
curl -f http://localhost:5000/health

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f notes-api
```

## 🔧 Database Migrations

```bash
# Add migration
dotnet ef migrations add InitialCreate

# Update database
dotnet ef database update

# Reset database
dotnet ef database drop
dotnet ef database update
```

## 📊 Performance Features

### Caching Strategy
- **User Cache**: 30 minutes
- **Notes Cache**: 5 minutes
- **Online Users**: 2 minutes
- **Workspace Metadata**: 15 minutes

### Viewport Optimization
```bash
# Get notes in viewport
GET /api/workspaces/demo-workspace/notes?viewportX=0&viewportY=0&viewportWidth=1920&viewportHeight=1080
```

### Concurrency Control
- Optimistic locking with version field
- Conflict detection and resolution
- Automatic retry mechanisms

## 🔐 Security Features

- **JWT Authentication**: Stateless token-based auth
- **XSS Protection**: HTML sanitization
- **CORS Policy**: Configurable origins
- **Rate Limiting**: Request throttling
- **Input Validation**: Comprehensive validation
- **SQL Injection Protection**: EF Core parameterized queries
- **Security Headers**: HSTS, XSS, Content-Type protection

## 🏥 Health Monitoring

### Health Check Endpoints
- `/health` - Overall application health
- `/health/ready` - Readiness for traffic
- `/health/live` - Liveness probe

### Logging
- **Structured Logging**: JSON format
- **Log Levels**: Debug, Info, Warning, Error, Fatal
- **Sinks**: Console, File, Future (Application Insights)
- **Performance Tracking**: Response times, query performance

## 🧪 Testing

```bash
# Run unit tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"

# Integration tests
dotnet test --filter Category=Integration
```

## 🌐 Cloud Migration Ready

### Azure
- App Service compatible
- Azure SQL Database ready
- Application Insights integration points
- Key Vault configuration hooks

### AWS
- ECS/Fargate compatible
- RDS compatibility
- CloudWatch logging ready
- Parameter Store integration

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Failed**
```bash
# Check database service
docker-compose ps sqlserver

# Check connection string
docker-compose exec notes-api env | grep ConnectionStrings
```

2. **JWT Token Invalid**
```bash
# Check JWT configuration
docker-compose exec notes-api env | grep JWT
```

3. **SignalR Connection Failed**
```bash
# Check CORS configuration
# Verify JWT token in query string for SignalR
```

### Debug Commands
```bash
# View application logs
docker-compose logs -f notes-api

# Check health status
curl http://localhost:5000/health

# Database logs
docker-compose logs -f sqlserver
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎯 Performance Targets

- **API Response Time**: < 200ms (95th percentile)
- **SignalR Latency**: < 50ms
- **Database Queries**: < 50ms
- **Memory Usage**: < 512MB per container
- **Concurrent Users**: 50+ per workspace
- **Notes per Workspace**: 1000+

## 📈 Monitoring

- Health check endpoints
- Structured logging
- Performance metrics
- Error tracking
- Resource utilization

---

Built with ❤️ using .NET 9 and modern cloud-native practices. 