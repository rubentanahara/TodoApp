# 📝 Collaborative Notes

Real-time collaborative sticky notes application with infinite canvas. Multiple users can create, edit, and organize notes together.

## ✨ Features

- **Real-time collaboration** with SignalR
- **Infinite canvas** with zoom/pan
- **Sticky notes** with text and images
- **Emoji reactions** on notes
- **Email-based authentication**
- **Dark/light themes**
- **Mobile responsive**

## 🏗️ Tech Stack

**Backend**: .NET 9.0, PostgreSQL, SignalR, JWT auth  
**Frontend**: Next.js 15.2, React 19, TypeScript, Tailwind CSS

## 🚀 Quick Start

### Docker (Recommended)
```bash
# Clone and start backend
git clone <repository-url>
cd collaborative_notes/backend
docker-compose up

# Start frontend (new terminal)
cd ../frontend
pnpm install && pnpm dev
```

**Access**: Frontend at http://localhost:3000, API at http://localhost:8080

### Manual Setup
```bash
# Backend
cd backend
dotnet ef database update
dotnet run

# Frontend  
cd frontend
pnpm install && pnpm dev
```

**Prerequisites**: .NET 9.0, Node.js 18+, PostgreSQL 16+

## 📖 Usage

1. Sign in with email
2. Create notes with "+" button or double-click canvas
3. Drag to move, click to edit
4. Add images and emoji reactions
5. Share workspace URL for collaboration 