using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotesApp.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUserCursorsIfExists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use raw SQL to safely drop the table if it exists
            migrationBuilder.Sql("DROP TABLE IF EXISTS \"UserCursors\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserCursors",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    WorkspaceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    X = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Y = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCursors", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserCursors_UserEmail_WorkspaceId",
                table: "UserCursors",
                columns: new[] { "UserEmail", "WorkspaceId" },
                unique: true);
        }
    }
}
