using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Pos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Pos_Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsHidden = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pos_OptionGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    SelectionType = table.Column<int>(type: "integer", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    MaxSelect = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_OptionGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pos_MenuItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DescriptionEn = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Tags = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SoldOutMode = table.Column<int>(type: "integer", nullable: true),
                    SoldOutUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsHidden = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_MenuItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_MenuItems_Pos_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Pos_Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_OptionChoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OptionGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    SoldOutMode = table.Column<int>(type: "integer", nullable: true),
                    SoldOutUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_OptionChoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_OptionChoices_Pos_OptionGroups_OptionGroupId",
                        column: x => x.OptionGroupId,
                        principalTable: "Pos_OptionGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Pos_MenuItemOptionGroups",
                columns: table => new
                {
                    MenuItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    OptionGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_MenuItemOptionGroups", x => new { x.MenuItemId, x.OptionGroupId });
                    table.ForeignKey(
                        name: "FK_Pos_MenuItemOptionGroups_Pos_MenuItems_MenuItemId",
                        column: x => x.MenuItemId,
                        principalTable: "Pos_MenuItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Pos_MenuItemOptionGroups_Pos_OptionGroups_OptionGroupId",
                        column: x => x.OptionGroupId,
                        principalTable: "Pos_OptionGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Pos_DiningTables",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Zone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    CodeChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CurrentSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_DiningTables", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pos_TableSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TableId = table.Column<Guid>(type: "uuid", nullable: false),
                    TableName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TransferredFromTableName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: true),
                    CashReceived = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ChangeAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    NeedVatInvoice = table.Column<bool>(type: "boolean", nullable: false),
                    ClosedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ClosedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CheckoutRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_TableSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_TableSessions_Pos_DiningTables_TableId",
                        column: x => x.TableId,
                        principalTable: "Pos_DiningTables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_TableSessions_System_Users_ClosedById",
                        column: x => x.ClosedById,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_Orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TableId = table.Column<Guid>(type: "uuid", nullable: false),
                    TableName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AutoConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    GuestName = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HandledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    HandledById = table.Column<Guid>(type: "uuid", nullable: true),
                    HandledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    RejectReason = table.Column<int>(type: "integer", nullable: true),
                    RejectNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CartKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_Orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_Orders_Pos_DiningTables_TableId",
                        column: x => x.TableId,
                        principalTable: "Pos_DiningTables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_Orders_Pos_TableSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Pos_TableSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_Orders_System_Users_HandledById",
                        column: x => x.HandledById,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_ServiceRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TableId = table.Column<Guid>(type: "uuid", nullable: false),
                    TableName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<int>(type: "integer", nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: true),
                    NeedVatInvoice = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    HandledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    HandledById = table.Column<Guid>(type: "uuid", nullable: true),
                    HandledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    AutoHandled = table.Column<bool>(type: "boolean", nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_ServiceRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_ServiceRequests_Pos_DiningTables_TableId",
                        column: x => x.TableId,
                        principalTable: "Pos_DiningTables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_ServiceRequests_Pos_TableSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Pos_TableSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pos_OrderItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    MenuItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ItemName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ItemPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Options = table.Column<string>(type: "text", nullable: false),
                    OptionsPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Note = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RemoveReason = table.Column<int>(type: "integer", nullable: true),
                    RemoveNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CancelReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ServedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ServedById = table.Column<Guid>(type: "uuid", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pos_OrderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pos_OrderItems_Pos_MenuItems_MenuItemId",
                        column: x => x.MenuItemId,
                        principalTable: "Pos_MenuItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pos_OrderItems_Pos_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Pos_Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Categories_Code",
                table: "Pos_Categories",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_DiningTables_Code",
                table: "Pos_DiningTables",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_DiningTables_CurrentSessionId",
                table: "Pos_DiningTables",
                column: "CurrentSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_DiningTables_Name",
                table: "Pos_DiningTables",
                column: "Name",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_MenuItemOptionGroups_OptionGroupId",
                table: "Pos_MenuItemOptionGroups",
                column: "OptionGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_MenuItems_CategoryId_SortOrder",
                table: "Pos_MenuItems",
                columns: new[] { "CategoryId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_MenuItems_Code",
                table: "Pos_MenuItems",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OptionChoices_OptionGroupId_SortOrder",
                table: "Pos_OptionChoices",
                columns: new[] { "OptionGroupId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OrderItems_MenuItemId",
                table: "Pos_OrderItems",
                column: "MenuItemId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OrderItems_OrderId",
                table: "Pos_OrderItems",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_OrderItems_Status",
                table: "Pos_OrderItems",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_ClientRequestId",
                table: "Pos_Orders",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_Code",
                table: "Pos_Orders",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_HandledById",
                table: "Pos_Orders",
                column: "HandledById");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_SessionId",
                table: "Pos_Orders",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_Status_SubmittedAt",
                table: "Pos_Orders",
                columns: new[] { "Status", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_SubmittedAt",
                table: "Pos_Orders",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_Orders_TableId_DeviceId_SubmittedAt",
                table: "Pos_Orders",
                columns: new[] { "TableId", "DeviceId", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_ServiceRequests_ClientRequestId",
                table: "Pos_ServiceRequests",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_ServiceRequests_SessionId",
                table: "Pos_ServiceRequests",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_ServiceRequests_Status_CreatedAt",
                table: "Pos_ServiceRequests",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_ServiceRequests_TableId_Status",
                table: "Pos_ServiceRequests",
                columns: new[] { "TableId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_TableSessions_CheckoutRequestId",
                table: "Pos_TableSessions",
                column: "CheckoutRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_TableSessions_ClosedById",
                table: "Pos_TableSessions",
                column: "ClosedById");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_TableSessions_Code",
                table: "Pos_TableSessions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pos_TableSessions_OpenedAt",
                table: "Pos_TableSessions",
                column: "OpenedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Pos_TableSessions_Status_ClosedAt",
                table: "Pos_TableSessions",
                columns: new[] { "Status", "ClosedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Pos_TableSessions_TableId_Status",
                table: "Pos_TableSessions",
                columns: new[] { "TableId", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_Pos_DiningTables_Pos_TableSessions_CurrentSessionId",
                table: "Pos_DiningTables",
                column: "CurrentSessionId",
                principalTable: "Pos_TableSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pos_DiningTables_Pos_TableSessions_CurrentSessionId",
                table: "Pos_DiningTables");

            migrationBuilder.DropTable(
                name: "Pos_MenuItemOptionGroups");

            migrationBuilder.DropTable(
                name: "Pos_OptionChoices");

            migrationBuilder.DropTable(
                name: "Pos_OrderItems");

            migrationBuilder.DropTable(
                name: "Pos_ServiceRequests");

            migrationBuilder.DropTable(
                name: "Pos_OptionGroups");

            migrationBuilder.DropTable(
                name: "Pos_MenuItems");

            migrationBuilder.DropTable(
                name: "Pos_Orders");

            migrationBuilder.DropTable(
                name: "Pos_Categories");

            migrationBuilder.DropTable(
                name: "Pos_TableSessions");

            migrationBuilder.DropTable(
                name: "Pos_DiningTables");
        }
    }
}
