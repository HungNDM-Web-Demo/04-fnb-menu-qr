using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Requests;
using Domain.Entities.Pos.Tables;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Yêu cầu từ bàn: Pos_ServiceRequests (06 §4).

public sealed class ServiceRequestConfiguration : IEntityTypeConfiguration<ServiceRequest>
{
    public void Configure(EntityTypeBuilder<ServiceRequest> builder)
    {
        builder.ToTable("Pos_ServiceRequests");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.TableName).HasMaxLength(ServiceRequest.TableNameMaxLength).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(ServiceRequest.NoteMaxLength);
        builder.Property(x => x.HandledByName).HasMaxLength(ServiceRequest.UserNameMaxLength);
        builder.Property(x => x.DeviceId).HasMaxLength(ServiceRequest.KeyMaxLength);
        builder.Property(x => x.ClientRequestId).HasMaxLength(ServiceRequest.KeyMaxLength);

        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.HasIndex(x => new { x.TableId, x.Status });
        builder.HasIndex(x => new { x.Status, x.CreatedAt });
        builder.HasIndex(x => x.SessionId);

        builder.HasOne<DiningTable>()
            .WithMany()
            .HasForeignKey(x => x.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<TableSession>()
            .WithMany()
            .HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
