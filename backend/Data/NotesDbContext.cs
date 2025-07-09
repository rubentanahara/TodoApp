using Microsoft.EntityFrameworkCore;
using NotesApp.Models;

namespace NotesApp.Data;

public class NotesDbContext : DbContext
{
    public NotesDbContext(DbContextOptions<NotesDbContext> options) : base(options)
    {
    }

    public DbSet<Note> Notes { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<UserCursor> UserCursors { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure Note entity
        modelBuilder.Entity<Note>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Content).IsRequired().HasMaxLength(10000);
            entity.Property(e => e.AuthorEmail).IsRequired().HasMaxLength(256);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.X).HasPrecision(10, 2);
            entity.Property(e => e.Y).HasPrecision(10, 2);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            entity.Property(e => e.Version).IsRequired().IsConcurrencyToken();
            
            // Indexes for performance
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.AuthorEmail);
            entity.HasIndex(e => new { e.WorkspaceId, e.X, e.Y });
            entity.HasIndex(e => e.CreatedAt);
        });

        // Configure User entity
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Email).IsRequired().HasMaxLength(256);
            entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastSeen).IsRequired();
            entity.Property(e => e.IsOnline).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            
            // Unique index on email
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.IsOnline);
            entity.HasIndex(e => e.LastSeen);
        });

        // Configure UserCursor entity
        modelBuilder.Entity<UserCursor>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).IsRequired().HasMaxLength(300);
            entity.Property(e => e.UserEmail).IsRequired().HasMaxLength(256);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.X).HasPrecision(10, 2);
            entity.Property(e => e.Y).HasPrecision(10, 2);
            entity.Property(e => e.LastUpdated).IsRequired();
            
            // Composite unique index for UserEmail + WorkspaceId
            entity.HasIndex(e => new { e.UserEmail, e.WorkspaceId }).IsUnique();
        });

        // Note: Removed ValueGeneratedOnAdd for UserCursor since we manually set the Id
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is Note && (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entry in entries)
        {
            var note = (Note)entry.Entity;
            if (entry.State == EntityState.Added)
            {
                note.CreatedAt = DateTime.UtcNow;
            }
            note.UpdatedAt = DateTime.UtcNow;
        }
    }
} 