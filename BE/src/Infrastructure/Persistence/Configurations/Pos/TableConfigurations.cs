using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Tables;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Bàn và mã QR: Pos_DiningTables (06 §4).

public sealed class DiningTableConfiguration : IEntityTypeConfiguration<DiningTable>
{
    public void Configure(EntityTypeBuilder<DiningTable> builder)
    {
        builder.ToTable("Pos_DiningTables");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).HasMaxLength(DiningTable.NameMaxLength).IsRequired();
        builder.Property(x => x.Zone).HasMaxLength(DiningTable.ZoneMaxLength).IsRequired();
        builder.Property(x => x.Code).HasMaxLength(PosRules.TableCodeLength).IsRequired();

        // Hai điện thoại cùng gửi đơn đầu: request sau thua, đọc lại và vào phiên vừa mở (BR-02).
        builder.Property(x => x.Version).IsConcurrencyToken();

        builder.HasIndex(x => x.Name).IsUnique().WhereNotDeleted();

        // Unique trên mọi dòng, kể cả bàn đã xóa: mã cũ không bao giờ sống lại (07 §5 quyết định 4).
        builder.HasIndex(x => x.Code).IsUnique();

        builder.HasOne<TableSession>()
            .WithMany()
            .HasForeignKey(x => x.CurrentSessionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
