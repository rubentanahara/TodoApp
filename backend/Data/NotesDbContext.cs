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
    public DbSet<NoteReaction> NoteReactions { get; set; }

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
            
            // Add image support configuration
            entity.Property(e => e.ImageUrls).HasMaxLength(2000);
            
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

        // Configure NoteReaction entity
        modelBuilder.Entity<NoteReaction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.NoteId).IsRequired();
            entity.Property(e => e.UserEmail).IsRequired().HasMaxLength(256);
            entity.Property(e => e.ReactionType).IsRequired().HasMaxLength(10);
            entity.Property(e => e.WorkspaceId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            
            // Configure relationship with navigation property
            entity.HasOne(e => e.Note)
                  .WithMany(n => n.Reactions)
                  .HasForeignKey(e => e.NoteId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            // Indexes for performance
            entity.HasIndex(e => e.NoteId);
            entity.HasIndex(e => e.UserEmail);
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.ReactionType);
            
            // Unique constraint: one reaction per user per note
            entity.HasIndex(e => new { e.NoteId, e.UserEmail }).IsUnique();
        });


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
        var noteEntries = ChangeTracker.Entries()
            .Where(e => e.Entity is Note && (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entry in noteEntries)
        {
            var note = (Note)entry.Entity;
            if (entry.State == EntityState.Added)
            {
                note.CreatedAt = DateTime.UtcNow;
            }
            note.UpdatedAt = DateTime.UtcNow;
        }
        
        var reactionEntries = ChangeTracker.Entries()
            .Where(e => e.Entity is NoteReaction && (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entry in reactionEntries)
        {
            var reaction = (NoteReaction)entry.Entity;
            if (entry.State == EntityState.Added)
            {
                reaction.CreatedAt = DateTime.UtcNow;
            }
            reaction.UpdatedAt = DateTime.UtcNow;
        }
    }
} 