using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotesApp.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteReactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NoteReactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ReactionType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    WorkspaceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NoteReactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NoteReactions_Notes_NoteId",
                        column: x => x.NoteId,
                        principalTable: "Notes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NoteReactions_NoteId",
                table: "NoteReactions",
                column: "NoteId");

            migrationBuilder.CreateIndex(
                name: "IX_NoteReactions_NoteId_UserEmail",
                table: "NoteReactions",
                columns: new[] { "NoteId", "UserEmail" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NoteReactions_ReactionType",
                table: "NoteReactions",
                column: "ReactionType");

            migrationBuilder.CreateIndex(
                name: "IX_NoteReactions_UserEmail",
                table: "NoteReactions",
                column: "UserEmail");

            migrationBuilder.CreateIndex(
                name: "IX_NoteReactions_WorkspaceId",
                table: "NoteReactions",
                column: "WorkspaceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NoteReactions");
        }
    }
}
