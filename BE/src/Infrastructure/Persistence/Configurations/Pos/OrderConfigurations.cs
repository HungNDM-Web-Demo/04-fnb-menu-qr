using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Tables;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Phiên bàn và đơn: Pos_TableSessions, Pos_Orders, Pos_OrderItems (06 §4). Không có navigation tới bảng xóa mềm (bàn, món)
// để truy vấn không mất phiên, đơn cũ của bàn, món đã xóa; tên bàn, tên món đã được chụp vào bản ghi.

public sealed class TableSessionConfiguration : IEntityTypeConfiguration<TableSession>
{
    public void Configure(EntityTypeBuilder<TableSession> builder)
    {
        builder.ToTable("Pos_TableSessions");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(TableSession.CodeMaxLength).IsRequired();
        builder.Property(x => x.TableName).HasMaxLength(TableSession.TableNameMaxLength).IsRequired();
        builder.Property(x => x.TransferredFromTableName).HasMaxLength(TableSession.TableNameMaxLength);
        builder.Property(x => x.Total).HasPrecision(18, 2);
        builder.Property(x => x.CashReceived).HasPrecision(18, 2);
        builder.Property(x => x.ChangeAmount).HasPrecision(18, 2);
        builder.Property(x => x.ClosedByName).HasMaxLength(TableSession.UserNameMaxLength);
        builder.Property(x => x.CheckoutRequestId).HasMaxLength(TableSession.KeyMaxLength);

        // 07 §3.6: thu tiền, chuyển bàn gửi kèm version.
        builder.Property(x => x.Version).IsConcurrencyToken();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.CheckoutRequestId).IsUnique();
        builder.HasIndex(x => new { x.TableId, x.Status });
        builder.HasIndex(x => new { x.Status, x.ClosedAt });
        builder.HasIndex(x => x.OpenedAt);

        builder.HasOne<DiningTable>()
            .WithMany()
            .HasForeignKey(x => x.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.ClosedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Orders)
            .WithOne()
            .HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Pos_Orders");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Order.CodeMaxLength).IsRequired();
        builder.Property(x => x.TableName).HasMaxLength(Order.TableNameMaxLength).IsRequired();
        builder.Property(x => x.GuestName).HasMaxLength(Order.GuestNameMaxLength);
        builder.Property(x => x.Note).HasMaxLength(Order.NoteMaxLength);
        builder.Property(x => x.HandledByName).HasMaxLength(Order.UserNameMaxLength);
        builder.Property(x => x.RejectNote).HasMaxLength(Order.NoteMaxLength);
        builder.Property(x => x.Total).HasPrecision(18, 2);
        builder.Property(x => x.DeviceId).HasMaxLength(Order.KeyMaxLength);
        builder.Property(x => x.ClientRequestId).HasMaxLength(Order.KeyMaxLength);
        builder.Property(x => x.CartKey).HasMaxLength(Order.KeyMaxLength);
        builder.Ignore(x => x.SortedItems);

        // UC-05 E3: hai nhân viên cùng xác nhận, từ chối.
        builder.Property(x => x.Version).IsConcurrencyToken();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.HasIndex(x => x.SessionId);
        builder.HasIndex(x => new { x.Status, x.SubmittedAt });
        builder.HasIndex(x => x.SubmittedAt);
        builder.HasIndex(x => new { x.TableId, x.DeviceId, x.SubmittedAt });

        builder.HasOne<DiningTable>()
            .WithMany()
            .HasForeignKey(x => x.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.HandledById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Items)
            .WithOne()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("Pos_OrderItems");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ItemCode).HasMaxLength(OrderItem.CodeMaxLength).IsRequired();
        builder.Property(x => x.ItemName).HasMaxLength(OrderItem.NameMaxLength).IsRequired();
        builder.Property(x => x.ItemPrice).HasPrecision(18, 2);
        builder.Property(x => x.Options).IsRequired();
        builder.Property(x => x.OptionsPrice).HasPrecision(18, 2);
        builder.Property(x => x.LineTotal).HasPrecision(18, 2);
        builder.Property(x => x.Note).HasMaxLength(OrderItem.NoteMaxLength);
        builder.Property(x => x.RemoveNote).HasMaxLength(OrderItem.ReasonMaxLength);
        builder.Property(x => x.CancelReason).HasMaxLength(OrderItem.ReasonMaxLength);
        builder.Property(x => x.CancelledByName).HasMaxLength(OrderItem.UserNameMaxLength);

        builder.HasIndex(x => x.OrderId);
        builder.HasIndex(x => x.MenuItemId);
        builder.HasIndex(x => x.Status);

        builder.HasOne<MenuItem>()
            .WithMany()
            .HasForeignKey(x => x.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
