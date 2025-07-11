using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotesApp.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    AuthorEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    X = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Y = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    WorkspaceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserCursors",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    UserEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    WorkspaceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    X = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Y = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCursors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LastSeen = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsOnline = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notes_AuthorEmail",
                table: "Notes",
                column: "AuthorEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Notes_CreatedAt",
                table: "Notes",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Notes_WorkspaceId",
                table: "Notes",
                column: "WorkspaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Notes_WorkspaceId_X_Y",
                table: "Notes",
                columns: new[] { "WorkspaceId", "X", "Y" });

            migrationBuilder.CreateIndex(
                name: "IX_UserCursors_UserEmail_WorkspaceId",
                table: "UserCursors",
                columns: new[] { "UserEmail", "WorkspaceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_IsOnline",
                table: "Users",
                column: "IsOnline");

            migrationBuilder.CreateIndex(
                name: "IX_Users_LastSeen",
                table: "Users",
                column: "LastSeen");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notes");

            migrationBuilder.DropTable(
                name: "UserCursors");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
